

//service logging configuration: "manageNetworks"   
var logger = log4js.getLogger('manageNetworks');


exports.manageNetworks = function(args){
  
    var spawn = require('child_process').spawn;
    
    switch(args[1]){
      
        case 'add-to-network':
            
            var basePort = nconf.get('config:socat:client:port');
            var rtpath = nconf.get('config:reverse:lib:bin');
            var reverseS_url = nconf.get('config:reverse:server:url_reverse')+":"+nconf.get('config:reverse:server:port_reverse');
            
            var sClientElem = {
                key: args[9],
                process: spawn('socat', ['-d','-d','TCP-L:'+ (parseInt(basePort)+args[9]) +',bind=localhost,reuseaddr,forever,interval=10','TUN:'+args[2]+'/30,tun-name=socattun'+args[9]+',up'])
            }
            logger.info('SOCAT COMMAND: socat -d -d TCP-L:'+ (parseInt(basePort)+args[9]) +',bind=localhost,reuseaddr,forever,interval=10 TUN:'+args[2]+'/30,tun-name=socattun'+args[9]+',up' );
            
            socatClient.push(sClientElem);
            
            sClientElem.process.stdout.on('data', function (data) {
                logger.info('SOCAT - stdout: ' + data);
            });
	    
            sClientElem.process.stderr.on('data', function (data) {
                var textdata = 'stderr: ' + data;
                logger.info("SOCAT - "+textdata);
		
                if(textdata.indexOf("starting data transfer loop") > -1) {
		  
                    spawn('ifconfig',['socattun'+args[9],'up']);
                    
                    var testing = spawn('ip',['link','add',args[8],'type','gretap','remote',args[3],'local',args[2]]);         
		    logger.info('NETWORK COMMAND: ip link add ' + args[8] + ' type gretap remote '+ args[3] +' local '+ args[2]);
                    
                    testing.on('error',function(err){throw err});
                    testing.stdout.on('data', function (data) {
                        logger.info('--> create link: ' + data);
                    });
                    testing.stderr.on('data', function (data) {
                        logger.info('--> create link: ' + data);
                    });
                    testing.on('close', function (code) {
                        logger.info('--> create link process exited with code ' + code);
			
                        if(code == 0) {
			  
                            greDevices.push(args[8]);
			    
                            var testing2 = spawn('ip',['addr','add',args[5]+'/'+args[7],'broadcast',args[6],'dev',args[8]]); 
			    logger.info('NETWORK COMMAND: ip link add ' + args[5]+'/'+args[7] + ' broadcast '+ args[6] +' dev '+ args[8]);
			    
                            testing2.stdout.on('add ip: ', function (data) { 
                                logger.info('--> stdout: ' + data); 
                            });
                            testing2.stderr.on('add ip: ', function (data) { 
                                logger.info('--> stderr: ' + data);
                            });
                            testing2.on('close', function (code) {
			      
                                logger.info('--> add ip process exited with code ' + code); 
				
                                var testing3 = spawn('ip',['link','set',args[8],'up']);
				logger.info('NETWORK COMMAND: ip link set ' + args[8] + ' up');
				
                                testing3.stdout.on('data', function (data) {
                                    logger.info('--> set link up: ' + data);
                                });
                                testing3.stderr.on('data', function (data) {
                                    logger.info('--> set link up: ' + data);
                                });
                                testing3.on('close', function (code) {
                                    logger.info('--> set link up process exited with code ' + code);
                                });
                            });
                        }
                    });
                }
            });
	    
            sClientElem.process.on('close', function (code) { //in case of disconnection, delete all interfaces
                logger.info('SOCAT - process exited with code ' + code);
            });

            
            
            var rtClientElem = {
                key: args[9],
                process: spawn(rtpath, ['-r '+args[4]+':localhost:'+(parseInt(basePort)+args[9]),reverseS_url])
            }
            
	    //DEBUG
	    //var rtpath = "/opt/demo/node-lighthing-rod-develop/node_modules/node-reverse-wstunnel/bin/wstt.js";
            logger.info("WSTT - " + rtpath + ' -r '+args[4]+':localhost:'+(parseInt(basePort)+args[9]),reverseS_url);
            
            
            rtClient.push(rtClientElem); 
            rtClientElem.stdout.on('data', function (data) {
                logger.info('WSTT - stdout: ' + data);
            });
            rtClientElem.stderr.on('data', function (data) {
                logger.info('WSTT - stderr: ' + data);
            });
            rtClientElem.on('close', function (code) {
                logger.warn('WSTT - process exited with code ' + code);
            });                                                                                                                                                                                                                                                                                                                                   //simply waiting, that's bad, but how else ?
            break;
	    
	    
            case 'remove-from-network':
                var position = findValue(socatClient,args[3],'key');
                socatClient[position].process.kill('SIGINT');
                rtClient[position].process.kill('SIGTERM');
                socatClient.splice(position,1);
                rtClient.splice(position,1);
                spawn('ip',['link','del',args[2]]);
                break;
		
		
            case 'update-board':
                var testing = spawn('ip',['link','set',args[3],'down']);
                testing.on('close', function (code) {
                    var testing2 = spawn('ip',['addr','del',args[4],'dev',args[3]]);
                    testing2.on('close',function (code) {
                        var testing3 = spawn('ip',['addr','add',args[2],'broadcast',args[5],'dev',args[3]]);
                        testing3.on('close',function (code) {
                            spawn('ip',['link','set',args[3],'up']);
                        })
                    });
                });
                break;
    }
}