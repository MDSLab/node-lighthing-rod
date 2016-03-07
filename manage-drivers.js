//service logging configuration: "manageDrivers"   
var logger = log4js.getLogger('manageDrivers');

var fs = require('fs');
var fuse = require('fuse-bindings')
var Q = require("q");


file_list = {};
mp_list = {};
driver_name = ""
fd_index = 3 //fd index used by Unix as file descriptor: we can use this index starting from 3 

mode_lookup_table = {
  rw: 33188, 	//rw-r--r-- 100644
  r: 33060	//r--r--r-- 100444
}



var device0_file = '/sys/bus/iio/devices/iio:device0/enable';

function readdirFunction(driver_name){
  
    var readdir_function = function (mountpoint, cb) {
      
	logger.info('readdir(%s) - files list: %s', mountpoint, JSON.stringify(file_list[driver_name]) )
	//if (mountpoint === '/') return cb(0, [driver_name]);
	//if (mountpoint === '/'+driver_name) return cb(0, file_list[driver_name] );
	  
	if (mountpoint === '/') return cb(0, file_list[driver_name] );

	cb(0)
    }
    return readdir_function
}

function getattrFunction(driver_name){
    var getattr_function = function (mountpoint, cb) {
      
	logger.info('getattr(%s)', mountpoint)
	
	driver_mp_node = mp_list[driver_name]
	
	if(driver_mp_node[mountpoint].mp != undefined){
	  cb(0, driver_mp_node[mountpoint].mp )
	  return
	}
	
	cb(fuse.ENOENT)

    }
    return getattr_function
}


function openFunction(){
  
    var open_function = function (mountpoint, flags, cb) {
      
	fd_index = fd_index + 1
	
	logger.info('Open(%s, %d) - fd = %s', mountpoint, flags, fd_index);
	
	cb(0, fd_index) //cb(0, 42) // 42 is an fd
    }
    return open_function
}



function readFunction(driver, driver_name){
  
    var read_function = function (mountpoint, fd, buf, len, pos, cb) {
      
	  logger.info('Read(%s, %d, %d, %d)', mountpoint, fd, len, pos);

	  driver_mp_node = mp_list[driver_name]	  
	  
	  driver[driver_mp_node[mountpoint].read_function]( function(read_content){
		var buffer = new Buffer(read_content.toString(), 'utf-8');
		var str = ''+buffer.slice(pos);
		if (!str)
		    return cb(0);     
		buf.write(str);
		return cb(str.length);
	  });      

	
    }  
    
    return read_function
    
}
 
function writeFunction(driver, driver_name){
  
      var write_function = function (mountpoint, fd, buffer, length, position, cb) {
	
	    logger.info('Writing', buffer.slice(0, length));
	    content = buffer.slice(0, length);
	    logger.info("--> buffer content: " + content.toString());
	    logger.info("--> buffer length: " + length.toString());
	    
	    driver_mp_node = mp_list[driver_name]	  
	  
	    if (driver_mp_node[mountpoint].write_function === null){
	      
		cb(fuse.EACCES);
		
	    } else {
		driver[driver_mp_node[mountpoint].write_function]( content, function(){
		    cb(length);
		});
	    }
	   
      } 
      
      return write_function
}


function MaskConversion(mode_b10){
  //var mode_b10 = 100644//40755
  mode_b8 = parseInt(mode_b10.toString(10), 8)
  //logger.info("from b10 "+mode_b10+" to b8 "+mode_b8)
  permission = mode_b8
  return permission
}

function HumanMaskConversion(mode){
  
  mode_b8 = parseInt(mode_b10.toString(10), 8)
  //logger.info("from b10 "+mode_b10+" to b8 "+mode_b8)
  permission = mode_b8
  return permission
}




function LoadDriver(driver_name, mountpoint, callback){
  
    
    var driver_path = "./drivers/"+driver_name;
    var driver_conf = driver_path+"/"+driver_name+".json";
    var driver_module = driver_path+"/"+driver_name+".js";
    var driver = require(driver_module);
    
    logger.info("DRIVER "+driver_name+" LOADING...");

    try{
      
	var driverJSON = JSON.parse(fs.readFileSync(driver_conf, 'utf8'));
	//logger.info(driverJSON);
	logger.info('--> JSON file '+ driver_name +'.json successfully parsed!');
	
	driver_name = driverJSON.name; 
	logger.info("--> Driver name: " + driver_name)
	var type = driverJSON.type; //logger.info("\tfile type: " + type)
	var permissions = MaskConversion(driverJSON.permissions); //logger.info("\tpermissions: " + MaskConversion(permissions))
	//var root_permissions = MaskConversion(driverJSON.root_permissions);
	var children = driverJSON.children; //logger.info("Files in the folder:")

	mp_list[driver_name]={}
	driver_mp_node = mp_list[driver_name]
	
	fuse_root_path='/';
	var root_mp = {
	    mtime: new Date(),
	    atime: new Date(),
	    ctime: new Date(),
	    size: 100,
	    mode: permissions,
	    uid: process.getuid(),
	    gid: process.getgid()
	}
	driver_mp_node[fuse_root_path]={
	    name: driver_name,
	    mp: {}
	}
	
	driver_mp_node[fuse_root_path].mp=root_mp;
	driver_mp_node[fuse_root_path].type = "folder";

	/*
	fuse_driver_path='/'+driver_name;		  
	var driver_mp ={ 
	    mtime: new Date(),
	    atime: new Date(),
	    ctime: new Date(),
	    size: 100,
	    mode: permissions,
	    uid: process.getuid(),
	    gid: process.getgid()
	}
	mp_list[fuse_driver_path]={
	    name:"driver",
	    mp: {}
	}
	mp_list[fuse_driver_path].mp=driver_mp;
	mp_list[fuse_driver_path].type = "folder";
	*/
	
	file_list[driver_name]=[]
		
	children.forEach(function(file) {
	  
	      //logger.info("\t"+file.name);
	      
	      file_list[driver_name].push(file.name);
	      
	      if(file.read_function != undefined){
		var read_function = file.read_function
	      }else{
		var read_function = null
	      }
	      
	      if(file.write_function != undefined){  
		var write_function = file.write_function
	      }else{
		var write_function = null
	      }
	      
	      //fuse_file_path='/'+driver_name+'/'+file.name;
	      fuse_file_path='/'+file.name;
	      var file_mp = { 

		  mtime: new Date(),
		  atime: new Date(),
		  ctime: new Date(),
		  size: 100,
		  mode: MaskConversion(file.permissions),
		  uid: process.getuid(),
		  gid: process.getgid()

	      }
	      driver_mp_node[fuse_file_path]={
		name:"",
		read_function: read_function,
		write_function: write_function,
		mp: {}
	      }
	      driver_mp_node[fuse_file_path].mp = file_mp;
	      driver_mp_node[fuse_file_path].name = file.name
	      driver_mp_node[fuse_file_path].type = "file";
	      driver_mp_node[fuse_file_path].read_function = read_function
	      driver_mp_node[fuse_file_path].write_function = write_function
	  
	});
	
	//logger.info("MP LIST: " + JSON.stringify(mp_list,null,"\t"))
	
	
	logger.info("DRIVER "+driver_name+" MOUNTING...");
	fs.writeFile(device0_file, '1', function(err) {
	  
	    if(err) {
	      
		logger.error('Error writing device0 file: ' + err);
		
	    } else {
	      
		logger.info("--> device0 successfully enabled!");
		
		logger.info("--> Files list of "+driver_name+" %s", JSON.stringify(file_list[driver_name]))
		//logger.info("FULL FILE LIST %s", JSON.stringify(file_list))
		
		try{
		      fuse.mount(mountpoint, {
			readdir: readdirFunction(driver_name),
			getattr: getattrFunction(driver_name),
			open: openFunction(),
			read: readFunction(driver, driver_name),
			write: writeFunction(driver, driver_name) 
		      })
		      
		      callback("driver '"+driver_name+"' successfully mounted!")
		}
		catch(err){
		    result = "ERROR during '"+driver_name+"' FUSE unmounting: " +err;
		    logger.error(result);
		    callback(result)
		}
		
		
		
	    }
	    
	}); 
	

    }
    catch(err){
	logger.error('Error during driver loading: '+err);
    }  
  
}


//This function injects a driver
exports.injectDriver = function (args, details){
    
   

}

//This function mounts a driver
exports.mountDriver = function (args, details){
    
    //Parsing the input arguments
    var driver_name = String(args[0])
    var result = "None"
    //var mountpoint = '../drivers/'+driver_name+'/driver';
    var mountpoint = '../drivers/'+driver_name;
    
    var d = Q.defer();
    
    logger.info("DRIVER "+driver_name+" ENV LOADING...");
    logger.info("--> Driver folder ("+mountpoint+") checking...")
    
    try{
      
	  if ( fs.existsSync(mountpoint) === false ){
	    
		//Create the directory, call the callback.
		fs.mkdir(mountpoint, 0755, function() {

		    logger.info("----> folder "+mountpoint+" CREATED!");
		    LoadDriver(driver_name, mountpoint, function(load_result){
			
			d.resolve(load_result);
			logger.info("--> "+load_result);
		      
		    });
		    
		});
		
	  }else{
	    
		logger.info("----> folder "+mountpoint+" EXISTS!");
		LoadDriver(driver_name, mountpoint, function(load_result){
		    
		    d.resolve(load_result);
		    logger.info("--> "+load_result);
		  
		});
	  }
	  
    } catch (err) {
	result = "Error during driver folder creation: " + err
	logger.error(result);
	d.resolve(result);
    }
  
    return d.promise;

}

//This function unmounts a driver
exports.unmountDriver = function (args, details){
    
    //Parsing the input arguments
    var driver_name = String(args[0])
    var result = "None"
    //var mountpoint = '../drivers/'+driver_name+'/driver';
    var mountpoint = '../drivers/'+driver_name;
    
    var d = Q.defer();
    
    logger.info("DRIVER '"+driver_name+"' UNMOUNTING...");
    
    fuse.unmount(mountpoint, function (err) {
      
	  if(err === undefined){

	      try{
		
		  //DATA cleaning------------------------------------------------------------------
		  file_list[driver_name]=null;
		  delete file_list[driver_name];
		  //logger.info("--> FILEs LIST UPDATED: " + JSON.stringify(file_list) )
		  logger.info("--> Files removed from list!" )
		  
		  mp_list[driver_name]=null;
		  delete mp_list[driver_name];	      
		  //logger.info("--> MPs LIST UPDATED: " + JSON.stringify(mp_list,null,"\t"))
		  logger.info("--> Mountpoints of "+driver_name+" removed!")
		  //-------------------------------------------------------------------------------
		    
		  result = "driver '"+driver_name+"' successfully unmounted!";
		  d.resolve(result);
		  logger.info("--> "+result);
	      }
	      catch(err){
		  logger.error('ERROR data cleaning "'+driver_name+'" during unmounting: '+err);
	      } 	      
	      
	  }else{
	      result = "ERROR during '"+driver_name+"' FUSE unmounting: " +err;
	      d.resolve(result);
	      logger.error("--> "+result);
	  }
      
    })   
    
    return d.promise;

}

//This function mounts all enabled drivers after a crash of Lightning-rod or a reboot of the board.
exports.mountAllEnabledDrivers = function (){
}

//This function exports all the functions in the module as WAMP remote procedure calls
exports.exportDriverCommands = function (session){
    
    //Read the board code in the configuration file
    var boardCode = nconf.get('config:board:code');
    
    
    
    //Register all the module functions as WAMP RPCs
    session.register('s4t.'+boardCode+'.driver.mountDriver', exports.mountDriver);
    session.register('s4t.'+boardCode+'.driver.unmountDriver', exports.unmountDriver); 
    /*
    session.register(boardCode+'.command.rpc.injectDriver', exports.injectDriver);
    session.register(boardCode+'.command.rpc.mountAllEnabledDrivers', exports.mountAllEnabledDrivers);
    */
    
    logger.info('[WAMP-EXPORTS] Driver commands exported to the cloud!');

    
}

