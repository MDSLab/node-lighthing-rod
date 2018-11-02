//############################################################################################
//##
//# Copyright (C) 2014-2017 Dario Bruneo, Francesco Longo, Giovanni Merlino, Nicola Peditto
//##
//# Licensed under the Apache License, Version 2.0 (the "License");
//# you may not use this file except in compliance with the License.
//# You may obtain a copy of the License at
//##
//# http://www.apache.org/licenses/LICENSE-2.0
//##
//# Unless required by applicable law or agreed to in writing, software
//# distributed under the License is distributed on an "AS IS" BASIS,
//# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//# See the License for the specific language governing permissions and
//# limitations under the License.
//##
//############################################################################################

//service logging configuration: "board-management"   
var logger = log4js.getLogger('board-management');


var fs = require("fs");

var board_session = null;

var spawn = require('child_process').spawn;

var LIGHTNINGROD_HOME = process.env.LIGHTNINGROD_HOME;

var exec = require('child_process').exec;
var Q = require("q");


// This function contains the logic that has to be performed if I'm connected to the WAMP server
function manage_WAMP_connection(session) {

    logger.info('[CONFIGURATION] - Board configuration starting...');

    //EXPORTING NETWORK COMMANDS
    checkModEnabled("vnets_manager").then(
        
        function (enabled) {

            if(enabled){
                var networksManager = require(LIGHTNINGROD_HOME + '/modules/vnets-manager/manage-networks');
                networksManager.Init(session);
            }

        }

    );
    
    //Topic on which the board can send a message to be registered
    var connectionTopic = 'board.connection';
    session.subscribe(connectionTopic, onTopicConnection);
    
    //Registering the board to the Cloud by sending a message to the connection topic
    logger.info("[WAMP] - Sending board ID '" + boardCode + "' to topic " + connectionTopic + " to register the board");
    session.publish(connectionTopic, [boardCode, 'connection', session._id]);

}

// This function manages the messages published in "board.connection" topic
function onTopicConnection(args) {
    var message = args[0];
    if (message == 'IoTronic-connected')
        logger.info("Message on board.connection: " + args[0])
    
}

function checkModEnabled(module_name) {

    var d = Q.defer();

    var configFile = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));

    var modules = configFile.config["board"]["modules"]; //console.log(module_name, modules[module_name]);

    d.resolve(modules[module_name]);

    return d.promise;

}

// This function loads the Lightning-rod modules
function moduleLoader (session, device) {

    logger.info("[SYSTEM] - Modules loading:");

    var configFile = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));

    var modules = configFile.config["board"]["modules"];

    var modules_keys = Object.keys( modules );

    for (var i = 0; i < modules_keys.length; i++) {

        (function (i) {

            var module_name = modules_keys[i];
            var enabled = modules[module_name]["enabled"];


            if(enabled)

                switch (module_name) {

                    case 'plugins_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        var pluginsManager = require(LIGHTNINGROD_HOME + '/modules/plugins-manager/manage-plugins');
                        pluginsManager.Init(session);
                        break;

                    case 'services_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        var servicesManager = require(LIGHTNINGROD_HOME + '/modules/services-manager/manage-services');
                        servicesManager.Init(session);

                        break;

                    case 'nodered_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        var nodeRedManager = require(LIGHTNINGROD_HOME + '/modules/nodered-manager/manage-nodered');
                        nodeRedManager.Init(session);
                        break;

                    /*
                    case 'vnets_manager':
                        break;
                    */

                    case 'gpio_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        var gpioManager = require(LIGHTNINGROD_HOME + '/modules/gpio-manager/manage-gpio');
                        gpioManager.Init(session, lyt_device);
                        break;

                    case 'drivers_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        var driversManager = require(LIGHTNINGROD_HOME + "/modules/drivers-manager/manage-drivers");
                        driversManager.Init(session);
                        driversManager.restartDrivers();
                        break;

                    case 'vfs_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        var fsManager = require(LIGHTNINGROD_HOME + "/modules/vfs-manager/manage-fs");
                        fsManager.Init(session);
                        var fsLibsManager = require(LIGHTNINGROD_HOME + "/modules/vfs-manager/manage-fs-libs");
                        fsLibsManager.exportFSLibs(session);
                        break;

                    default:

                        //logger.error("[SYSTEM] --> Wrong module: " + module_name)

                        break;



                }


        })(i);

    }
    
    /*
    // MODULES LOADING--------------------------------------------------------------------------------------------------
    var gpioManager = require(LIGHTNINGROD_HOME + '/modules/gpio-manager/manage-gpio');
    gpioManager.Init(session, lyt_device);

    var pluginsManager = require(LIGHTNINGROD_HOME + '/modules/plugins-manager/manage-plugins');
    pluginsManager.Init(session);

    var driversManager = require(LIGHTNINGROD_HOME + "/modules/drivers-manager/manage-drivers");
    driversManager.Init(session);
    driversManager.restartDrivers();

    var fsManager = require(LIGHTNINGROD_HOME + "/modules/vfs-manager/manage-fs");
    fsManager.Init(session);
    var fsLibsManager = require(LIGHTNINGROD_HOME + "/modules/vfs-manager/manage-fs-libs");
    fsLibsManager.exportFSLibs(session);

    var servicesManager = require(LIGHTNINGROD_HOME + '/modules/services-manager/manage-services');
    servicesManager.Init(session);

    var nodeRedManager = require(LIGHTNINGROD_HOME + '/modules/nodered-manager/manage-nodered');
    nodeRedManager.Init(session);
    //------------------------------------------------------------------------------------------------------------------
    */

}


// This function loads at boot the Lightning-rod modules
exports.moduleLoaderOnBoot = function() {

    logger.info("[SYSTEM] - Modules loading:");

    var configFile = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));

    var modules = configFile.config["board"]["modules"]; //console.log(modules);

    var modules_keys = Object.keys( modules ); //console.log(modules_keys);

    for (var i = 0; i < modules_keys.length; i++) {

        (function (i) {

            var module_name = modules_keys[i];
            var enabled = modules[module_name]["boot"];
            
            if(enabled)

                switch (module_name) {

                    case 'plugins_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        var pluginsManager = require(LIGHTNINGROD_HOME + '/modules/plugins-manager/manage-plugins');
                        pluginsManager.Boot();
                        break;

                    case 'services_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        var servicesManager = require(LIGHTNINGROD_HOME + '/modules/services-manager/manage-services');
                        servicesManager.Boot();
                        break;

                    case 'nodered_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        var nodeRedManager = require(LIGHTNINGROD_HOME + '/modules/nodered-manager/manage-nodered');
                        nodeRedManager.Boot();
                        break;

                    
                     case 'vnets_manager':
                         logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                     break;
                    

                    case 'gpio_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        break;

                    case 'drivers_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);
                        break;

                    case 'vfs_manager':
                        logger.info("[SYSTEM] --> " + module_name + ": " + enabled);

                    default:

                        logger.warn("[SYSTEM] --> Wrong module: " + module_name);

                        break;



                }


        })(i);

    }
    

}




// Init() LR function in order to control the correct LR configuration:
// - logging setup
// - settings control
exports.Init_Ligthning_Rod = function (callback) {

    log4js.loadAppender('file');

    function LogoLR() {
        logger.info('##############################');
        logger.info('  Stack4Things Lightning-rod');
        logger.info('##############################');
    }

    /*
     OFF	nothing is logged
     FATAL	fatal errors are logged
     ERROR	errors are logged
     WARN	warnings are logged
     INFO	infos are logged
     DEBUG	debug infos are logged
     TRACE	traces are logged
     ALL	everything is logged
     */

    try {

        //check logfile parameter
        logfile = nconf.get('config:log:logfile');

        if (logfile === "undefined" || logfile == "") {
            // DEFAULT LOGGING CONFIGURATION LOADING
            logfile = './s4t-lightning-rod.log';
            log4js.addAppender(log4js.appenders.file(logfile));
            logger = log4js.getLogger('main');		//service logging configuration: "main"

            LogoLR();

            callback({result: "ERROR"});

        } else {

            log4js.addAppender(log4js.appenders.file(logfile));
            logger = log4js.getLogger('main');		//service logging configuration: "main"

            LogoLR();

            //check loglevel parameter
            loglevel = nconf.get('config:log:loglevel');

            if (loglevel === "undefined" || loglevel == "") {

                logger.setLevel('INFO');
                logger.warn('[SYSTEM] - LOG LEVEL not specified... default has been set: INFO');

            } else {

                logger.setLevel(loglevel);
                logger.info('[SYSTEM] - LOG LEVEL: ' + loglevel);

            }

            //Start LR settings checks
            exports.checkSettings(function (check) {

                if (check === true) {
                    callback({result: "SUCCESS"});
                } else {
                    callback({result: "ERROR"});
                }

            });

        }

    }
    catch (err) {
        // DEFAULT LOGGING
        logfile = './s4t-lightning-rod.log';
        log4js.addAppender(log4js.appenders.file(logfile));
        logger = log4js.getLogger('main');		//service logging configuration: "main"
        LogoLR();
        logger.error('[SYSTEM] - Logger configuration error: ' + err);
        callback({result: "ERROR"});

    }

};


// This function checks the settings correctness
exports.checkSettings = function (callback) {

    try {

        var check_response = null;

        //WAMP CONF
        url_wamp = nconf.get('config:wamp:url_wamp');
        port_wamp = nconf.get('config:wamp:port_wamp');
        realm = nconf.get('config:wamp:realm');

        if ((url_wamp == undefined || url_wamp == "") || (port_wamp == undefined || port_wamp == "") || (realm == undefined || realm == "")) {

            logger.warn('[SYSTEM] - WAMP configuration is wrong or not specified!');
            logger.debug(' - url_wamp value: ' + url_wamp);
            logger.debug(' - port_wamp value: ' + port_wamp);
            logger.debug(' - realm value: ' + realm);

            process.exit();

        } else {
            check_response = true;
        }
        
        //REVERSE CONF
        url_reverse = nconf.get('config:reverse:server:url_reverse');
        port_reverse = nconf.get('config:reverse:server:port_reverse');
        wstun_lib = nconf.get('config:reverse:lib:bin');

        if ((url_reverse == undefined || url_reverse == "") || (port_reverse == undefined || port_reverse == "") || (wstun_lib == undefined || wstun_lib == "")) {

            logger.warn('[SYSTEM] - WSTUN configuration is wrong or not specified!');
            logger.debug(' - url_reverse value: ' + url_reverse);
            logger.debug(' - port_reverse value: ' + port_reverse);
            logger.debug(' - wstun_lib value: ' + wstun_lib);

            process.exit();

        } else {
            check_response = true;
        }

        // BOARD CONF
        device = nconf.get('config:device');
        
        if (device == undefined || device == "") {
            logger.warn('[SYSTEM] - Device "' + device + '" not supported!');
            logger.warn(' - Supported devices are: "laptop", "arduino_yun", "raspberry_pi".');
            process.exit();
        }

        boardCode = nconf.get('config:board:code');
        if (boardCode == undefined || boardCode == "") {
            logger.warn('[SYSTEM] - Board UUID undefined or not specified!');
            process.exit();
        } else {
            check_response = true;
        }

        reg_status = nconf.get('config:board:status');
        
        boardLabel = nconf.get('config:board:label');

        var board_position = nconf.get('config:board:position');

        if ( (board_position == undefined || Object.keys(board_position).length === 0 ) && (reg_status == "registered") ) {
            logger.warn('[SYSTEM] - Wrong board coordinates!');
            logger.debug('- Coordinates: ' + JSON.stringify(board_position));
            process.exit();

        }

        // SOCAT CONF
        var socat_port = nconf.get('config:socat:client:port');

        if (socat_port == undefined || socat_port == "") {
            logger.warn("[SYSTEM] - 'socat_port' not specified or 'undefined': if the board is network enabled specify this parameter!");
        }

        callback(check_response);


    }
    catch (err) {
        // DEFAULT LOGGING
        log4js = require('log4js');
        log4js.loadAppender('file');
        logfile = './s4t-lightning-rod.log';
        log4js.addAppender(log4js.appenders.file(logfile));

        //service logging configuration: "main"
        logger = log4js.getLogger('main');

        logger.error('[SYSTEM] - ' + err);
        process.exit();

    }


};


// This function sets the coordinates of the device: called by Iotronic via RPC
exports.setBoardPosition = function (args) {

    var board_position = args[0];
    logger.info("[SYSTEM] - Set board position: " + JSON.stringify(board_position));

    var configFile = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
    var board_config = configFile.config["board"];
    logger.info("[SYSTEM] --> BOARD CONFIGURATION " + JSON.stringify(board_config));

    board_config["position"] = board_position;
    logger.info("[SYSTEM] --> BOARD POSITION UPDATED: " + JSON.stringify(board_config["position"]));

    //Updates the settings.json file
    fs.writeFile(SETTINGS, JSON.stringify(configFile, null, 4), function (err) {
        if (err) {
            logger.error('[SYSTEM] --> Error writing settings.json file: ' + err);
        } else {
            logger.debug("[SYSTEM] --> settings.json configuration file saved to " + SETTINGS);
        }
    });

    return "Board configuration file updated!";


};


// This function create the settings.json file of the board injected by IoTronic
exports.updateConf = function (args) {

    var d = Q.defer();

    var response = {
        message: '',
        result: ''
    };

    // activate listener on-exit event after LR exit on-update-conf
    logger.debug("[SYSTEM] - Listener on process 'exit' event activated:");
    logger.debug("[SYSTEM] --> Lightning-rod PID: " + process.pid);
    process.on("exit", function () {
        require("child_process").spawn(process.argv.shift(), process.argv, {
            cwd: process.cwd(),
            detached : true,
            stdio: "inherit"
        });
    });


    var remote_conf = args[0].message;

    logger.info("[SYSTEM] - Board configuration injected: " + JSON.stringify(remote_conf, null, "\t"));

    logger.info("[SYSTEM] --> BOARD CONF UPDATED: " + JSON.stringify(remote_conf));

    //Updates the settings.json file
    fs.writeFile(SETTINGS, JSON.stringify(remote_conf, null, "\t"), function (err) {
        if (err) {

            response.message = 'Error writing settings.json file: ' + err;
            response.result = "ERROR";
            logger.error('[SYSTEM] --> ' +response.message);
            d.resolve(response);

        } else {

            logger.debug("[SYSTEM] --> settings.json configuration file saved to " + SETTINGS);
            response.message = "Board '"+boardCode+"' configuration updated!";
            response.result = "SUCCESS";
            d.resolve(response);

            //Restarting LR
            setTimeout(function () {
                process.exit();
            }, 1000)


        }
    });

    return d.promise;

};


// This function update the board configuration
exports.setConf = function (args) {

    var remote_conf = args[0].message;

    logger.info("[SYSTEM] - Board configuration injected: " + JSON.stringify(remote_conf, null, "\t"));

    var d = Q.defer();

    var response = {
        message: '',
        result: ''
    };

    // activate listener on-exit event after LR exit on-update-conf
    logger.debug("[SYSTEM] --> Listener on process 'exit' event activated:");
    logger.debug("[SYSTEM] --> Lightning-rod PID: " + process.pid);
    process.on("exit", function () {
        require("child_process").spawn(process.argv.shift(), process.argv, {
            cwd: process.cwd(),
            detached : true,
            stdio: "inherit"
        });
    });


    logger.info("[SYSTEM] --> Updating board configuration: " + JSON.stringify(remote_conf));

    //Updates the settings.json file
    fs.writeFile(SETTINGS, JSON.stringify(remote_conf, null, "\t"), function (err) {
        if (err) {

            response.message = 'Error writing settings.json file: ' + err;
            response.result = "ERROR";
            logger.error('[SYSTEM] --> ' +response.message);
            d.resolve(response);

        } else {

            logger.debug("[SYSTEM] --> settings.json configuration file saved to " + SETTINGS);
            response.message = "Board '"+boardCode+"' configuration updated!";
            response.result = "SUCCESS";
            d.resolve(response);




        }
    });

    return d.promise;

};


// This function manages the registration status of the board
exports.checkRegistrationStatus = function(args){

    var regStatus = args[0];

    var response = {
        message: '',
        result: ''
    };

    var d = Q.defer();


    if(regStatus.result == "SUCCESS"){

        logger.info("[SYSTEM] - Connection to Iotronic "+regStatus.result+":\n"+JSON.stringify(regStatus.message, null, "\t"));

        exports.exportManagementCommands(board_session);


        if(regStatus.message['state'] == "new"){

            logger.info('[CONFIGURATION] - NEW BOARD CONFIGURATION STARTED... ');

            var confBundle = {
                message: ''
            };

            regStatus.message['conf']['config']['board']['status'] = "registered";
            confBundle.message = regStatus.message['conf'];

            exports.setConf([confBundle]).then(

                function (msg) {

                    console.log(msg);

                    d.resolve(msg);
                    
                    //Restarting LR
                    setTimeout(function () {
                        process.exit();
                    }, 2000)


                }

            )



        }
        else if(regStatus.message['state'] == "registered"){

            logger.info("[SYSTEM] - Board registered - Start module loading... ");

            moduleLoader(board_session, lyt_device);

            response.message = "Board '"+boardCode+"' is loading modules.";
            response.result = "SUCCESS";
            d.resolve(response);
            

        } else{

            d.resolve("Board "+boardCode+" in wrong status!");

            logger.error('[CONFIGURATION] - WRONG BOARD STATUS: status allowed "new" or "registerd"!');
            process.exit();

        }
        

    }
    else {
        
        // IF access to IoTronic was rejected
        logger.error("[SYSTEM] - Connection to Iotronic " + regStatus.result + " - " + regStatus.message);
        logger.info("[SYSTEM] - Bye");

        d.resolve("Board " + boardCode + " disconnection...");

        process.exit();
        
    }


    return d.promise;

};


// To execute pre-defined commands in the board shell
exports.execAction = function(args){

    var d = Q.defer();

    var action = args[0];
    var params = args[1];


    logger.info("[SYSTEM] - execAction on board RPC called: '" + action + "' action...");


    var response = {
        message: '',
        result: ''
    };

    switch (action) {

        case 'reboot':

            logger.info('[SYSTEM] - Rebooting...');
            response.message = "Rebooting";
            response.result = "SUCCESS";
            d.resolve(response);

            exec('reboot', function(error, stdout, stderr){

                if(error) {
                    logger.error('[SYSTEM] - Reboot result: ' + error);
                    response.message = error;
                    response.result = "ERROR";
                    d.resolve(response);
                }
                else if (stderr){
                    if (stderr == "")
                        stderr = "rebooting...";

                    logger.info('[SYSTEM] - Reboot result: ' + stderr);
                    response.message = stderr;
                    response.result = "WARNING";
                    d.resolve(response);
                }
                else{
                    logger.info('[SYSTEM] - Reboot result: ' + stdout);
                    response.message = stdout;
                    response.result = "SUCCESS";
                    d.resolve(response);
                }


            });

            break;

        case 'hostname':

            exec('echo `hostname`', function(error, stdout, stderr){

                if(error) {
                    logger.error('[SYSTEM] - Echo result: ' + error);
                    response.message = error;
                    response.result = "ERROR";
                    d.resolve(response);
                }
                else if (stderr){
                    if (stderr == "")
                        stderr = "Doing echo...";

                    logger.info('[SYSTEM] - Echo result: ' + stderr);
                    response.message = stderr;
                    response.result = "WARNING";
                    d.resolve(response);
                }
                else{
                    stdout = stdout.replace(/\n$/, '');
                    logger.info('[SYSTEM] - Echo result: ' + stdout);
                    response.message = stdout;
                    response.result = "SUCCESS";
                    d.resolve(response);
                }

            });
            break;


        case 'restart_lr':

            params=JSON.parse(params);

            logger.info("[SYSTEM] --> parameters:\n" + JSON.stringify(params, null, "\t"));

            // activate listener on-exit event after LR exit on-update-conf
            logger.debug("[SYSTEM] --> Listener on process 'exit' event activated:");
            logger.debug("[SYSTEM] --> Lightning-rod PID: " + process.pid);
            process.on("exit", function () {

                require("child_process").spawn(process.argv.shift(), process.argv, {
                    cwd: process.cwd(),
                    detached : true,
                    stdio: "inherit"
                });

            });

            logger.info('[SYSTEM] - Restarting Lightning-rod');
            response.message = "Restarting Lightning-rod on board "+ boardCode;
            response.result = "SUCCESS";
            d.resolve(response);

            //Restarting LR
            setTimeout(function () {
                
                process.exit();
                
            }, params["time"]);


            break;

        default:
            
            response.message = "Board operation '" + action + "' not supported!";
            response.result = 'ERROR';
            logger.error("[SYSTEM] - " + response.message);
            d.resolve(JSON.stringify(response));

            break;

    }




    return d.promise;


};





exports.IotronicLogin = function (session) {

    board_session = session;

    session.register('s4t.' + session._id + '.board.checkRegistrationStatus', exports.checkRegistrationStatus);

    manage_WAMP_connection(session)

};



exports.exportManagementCommands = function (session, callback) {

    //Register all the module functions as WAMP RPCs
    logger.info('[WAMP-EXPORTS] Management commands exported to the cloud!');
    session.register('s4t.' + boardCode + '.board.setBoardPosition', exports.setBoardPosition);
    session.register('s4t.' + boardCode + '.board.execAction', exports.execAction);
    session.register('s4t.' + boardCode + '.board.updateConf', exports.updateConf);

};

