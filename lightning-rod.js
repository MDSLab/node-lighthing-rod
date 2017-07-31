/*
*				                  Apache License
*                           Version 2.0, January 2004
*                        http://www.apache.org/licenses/
*
*      Copyright (c) 2014 2015 2016 Dario Bruneo, Francesco Longo, Giovanni Merlino, Andrea Rocco Lotronto, Arthur Warnier, Nicola Peditto
* 
*/



// LIBRARIES
var fs = require("fs");
var spawn = require('child_process').spawn;
var running = require('is-running');			// We use this library to check if a process is running (PID check)
var autobahn = require('autobahn');

//settings parser
nconf = require('nconf');
SETTINGS = process.env.IOTRONIC_HOME+'/settings.json';
nconf.file ({file: SETTINGS});

//logging configuration: "board-management"
log4js = require('log4js');
logger = log4js.getLogger('main');

// Device settings
boardCode = null;		//valued in checkSettings
board_position = null;	//valued by Iotronic RPC funcion (provisioning)
reg_status = null;		//valued in checkSettings
device = null;			//valued in checkSettings


// To test the connection status
online = true;				// We use this flag during the process of connection recovery
reconnected = false;		// We use this flag to identify the connection status of reconnected after a connection fault
keepWampAlive = null;		// It is a timer related to the function that every "X" seconds/minutes checks the connection status
var tcpkill_pid = null;		// PID of tcpkill process spawned to manage the connection recovery process
wamp_check = null;			// "false" = we need to restore the WAMP connection (with tcpkill). "true" = the WAMP connection is enstablished or the standard reconnection procedure was triggered by the WAMP client and managed by "onclose" precedure.


// LR s4t libraries
var manageBoard = require('./board-management');



net_backend='';

//Init_Ligthning_Rod(function (check) {
manageBoard.Init_Ligthning_Rod(function (check) {

	if(check.result === "ERROR"){

		// Got a critical error in configuration file (settings.json)

		logger.error('[SYSTEM] - Logger configuration is wrong or not specified!');

		var log_template={log: {logfile: "<LOG-FILE>", loglevel: "<LOG-LEVEL>"}};
		logger.error("[SYSTEM] - Logger configuration expected: \n" + JSON.stringify(log_template, null, "\t"));
		
		process.exit();
		
	}else{

		// Configuration file is correctly configured... Starting LR...


		var wampUrl = nconf.get('config:wamp:url_wamp')+":"+nconf.get('config:wamp:port_wamp')+"/ws";
		var wampIP = wampUrl.split("//")[1].split(":")[0];
		
		logger.info("[SYSTEM] - Iotronic server IP: "+wampIP);

		var connectionTester = require('connection-tester');

		connectionTester.test(wampIP, 8888, 1000, function (err, output) {

			//logger.debug("[WAMP] - CONNECTION STATUS: "+JSON.stringify(output));

			var reachable = output.success;
			var error_test = output.error;

			//logger.debug("[WAMP] - CONNECTION STATUS: "+reachable);

			if (!reachable) {

				//CONNECTION STATUS: FALSE
				logger.error("[CONNECTION] - Iotronic server unreachable (test result = " + reachable + ")");
				logger.error("[CONNECTION] --> Error reported: " + error_test);
				process.exit();

			} else {

				logger.info('[SYSTEM] - DEVICE: ' + device);

				//----------------------------------------
				// 1. Set WAMP connection configuration
				//----------------------------------------
				var wampUrl = nconf.get('config:wamp:url_wamp')+":"+nconf.get('config:wamp:port_wamp')+"/ws";
				var wampRealm = nconf.get('config:wamp:realm');
				var wampConnection = new autobahn.Connection({
					url: wampUrl,
					realm: wampRealm,
					max_retries: -1
				});

				var wampIP = wampUrl.split("//")[1].split(":")[0];
				logger.info("[SYSTEM] - WAMP server IP: "+wampIP);

				logger.info("[SYSTEM] - Node ID: "+boardCode);


				//----------------------------------------------------------------------------------------
				// 3. On WAMP connection open the device will load LR libraries and start each LR module
				//----------------------------------------------------------------------------------------
				//This function is called as soon as the connection is created successfully
				wampConnection.onopen = function (session, details) {

					if (keepWampAlive != null){

						//We trigger this event after a connection recovery: we are deleting the previous timer for the function that checks the connection status
						clearInterval( keepWampAlive );
						logger.info('[WAMP-RECOVERY] - WAMP CONNECTION RECOVERED!');
						logger.debug('[WAMP-RECOVERY] - Old timer to keep alive WAMP connection cleared!');
						reconnected = true;

					}

					logger.info('[WAMP] - Connection to WAMP server '+ wampUrl + ' created successfully:');
					logger.info('[WAMP] |--> Realm: '+ wampRealm);
					logger.info('[WAMP] |--> Session ID: '+ session._id);
					//logger.debug('[WAMP] |--> Connection details:\n'+ JSON.stringify(details));


					// RPC registration of Board Management Commands
					manageBoard.exportManagementCommands(session);


					var configFile = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
					var board_config = configFile.config["board"];

					logger.info("[CONFIGURATION] - Board configuration parameters: " + JSON.stringify(board_config));

					//PROVISIONING: Iotronic sends coordinates to this device when its status is "new"
					if(reg_status === "new"){

						logger.info('[CONFIGURATION] - NEW BOARD CONFIGURATION STARTED... ');

						session.call("s4t.board.provisioning", [boardCode]).then(

							function(result){

								logger.info("\n\nPROVISIONING "+boardCode+" RECEIVED: " + JSON.stringify(result) + "\n\n");

								board_position = result.message[0];
								board_config["position"]=result.message[0];
								board_config["status"]="registered";

								logger.info("\n[CONFIGURATION] - BOARD POSITION UPDATED: " + JSON.stringify(board_config["position"]));

								//Updates the settings.json file
								fs.writeFile(SETTINGS, JSON.stringify(configFile, null, 4), function(err) {
									if(err) {
										logger.error('Error writing settings.json file: ' + err);

									} else {
										logger.info("settings.json configuration file saved to " + SETTINGS);
										//Calling the manage_WAMP_connection function that contains the logic that has to be performed if the device is connected to the WAMP server
										manageBoard.manage_WAMP_connection(session, details);
									}
								});

								//Create a backup file of settings.json
								fs.writeFile(SETTINGS + ".BKP", JSON.stringify(configFile, null, 4), function(err) {
									if(err) {
										logger.error('Error writing settings.json.BKP file: ' + err);

									} else {
										logger.info("settings.json.BKP configuration file saved to " + SETTINGS + ".BKP");
									}
								});


							}, session.log);


					} else if(reg_status === "registered"){

						//Calling the manage_WAMP_connection function that contains the logic that has to be performed if the device is connected to the WAMP server
						manageBoard.manage_WAMP_connection(session, details);

					} else{

						logger.error('[CONFIGURATION] - WRONG BOARD STATUS: status allowed "new" or "registerd"!');
						process.exit();

					}



					//----------------------------------------------------------------------------------------------------
					// THIS IS AN HACK TO FORCE RECONNECTION AFTER A BREAK OF INTERNET CONNECTION
					//----------------------------------------------------------------------------------------------------

					// The function managed by setInterval checks the connection status every "X" TIME
					keepWampAlive = setInterval(function(){

						// connectionTester: library used to check the reachability of Iotronic-Server/WAMP-Server
						var connectionTester = require('connection-tester');
						connectionTester.test(wampIP, 8888, 1000, function (err, output) {

							//logger.debug("[WAMP] - CONNECTION STATUS: "+JSON.stringify(output));

							var reachable = output.success;
							var error_test = output.error;

							//logger.debug("[WAMP] - CONNECTION STATUS: "+reachable);

							if(!reachable){

								//CONNECTION STATUS: FALSE
								logger.warn("[CONNECTION-RECOVERY] - INTERNET CONNECTION STATUS: "+reachable+ " - ERROR: "+error_test);
								wamp_check = false;
								online = false;

							} else {

								//CONNECTION STATUS: TRUE
								try{

									if(!online){
										// In the previous checks the "online" flag was set to FALSE.
										// The connection is come back ("online" is TRUE)

										logger.info("[CONNECTION-RECOVERY] - INTERNET CONNECTION STATUS: "+reachable);
										logger.info("[CONNECTION-RECOVERY] - INTERNET CONNECTION RECOVERED!");

										//we need to test the WAMP connection
										session.publish ('board.connection', [ 'alive-'+boardCode ], {}, { acknowledge: true}).then(

											function(publication) {
												logger.info("[WAMP-ALIVE-STATUS] - WAMP ALIVE MESSAGE RESPONSE: published -> publication ID is " + JSON.stringify(publication));
												wamp_check = true;
											},
											function(error) {
												logger.warn("[WAMP-RECOVERY] - WAMP ALIVE MESSAGE: publication error " + JSON.stringify(error));
												wamp_check = false;
											}

										);

										//It will wait the WAMP alive message response
										setTimeout(function(){

											// If the message sent to WAMP server was correctly published (so "wamp_check" is TRUE) means
											// WAMP connection is established and the previous connection fault didn't compromise the WAMP socket
											// so we don't need to restore the WAMP connection and we set the connection status ("online") to TRUE.
											if (wamp_check){

												// WAMP CONNECTION IS ESTABLISHED
												logger.debug("[WAMP-ALIVE-STATUS] - WAMP CONNECTION STATUS: " + wamp_check);
												online = true;

												//logger.warn(boardCode+" needs to be restored!");
												//manageNetworks.setSocatOnBoard([socatServer_ip, socatServer_port, socatBoard_ip, net_backend, boardCode, true] );  //TO RESTORE

											}
											else{

												// WAMP CONNECTION IS NOT ESTABLISHED: if after a connection fault the message publishing to WAMP server failed and the WAMP connection recovery procedure
												// didn't start automatically we need to KILL the WAMP socket through the TCPKILL tool (problem noticed in WIFI connection with DSL internet connection).

												logger.warn("[WAMP-ALIVE-STATUS] - WAMP CONNECTION STATUS: " + wamp_check);

												// Check if the tcpkill process was killed after a previous connection recovery
												// Through this check we will avoid to start another tcpkill process
												var tcpkill_status = running(tcpkill_pid);

												logger.warn("[WAMP-ALIVE-STATUS] - TCPKILL STATUS: " + tcpkill_status + " - PID: " +tcpkill_pid);


												// at LR startup "tcpkill_pid" is NULL and in this condition "is-running" module return "true" that is a WRONG result!
												if (tcpkill_status === false || tcpkill_pid == null){

													logger.warn("[WAMP-RECOVERY] - Cleaning WAMP socket...");
													var tcpkill_kill_count = 0;

													//tcpkill -9 port 8181
													var tcpkill = spawn('tcpkill',['-9','port','8181']);
													tcpkill_pid = tcpkill.pid;

													tcpkill.stdout.on('data', function (data) {
														logger.debug('[WAMP-RECOVERY] ... tcpkill stdout: ' + data);
													});

													tcpkill.stderr.on('data', function (data) {

														logger.debug('[WAMP-RECOVERY] ... tcpkill stderr:\n' + data);

														//it will check if tcpkill is in listening state on the port 8181
														if(data.toString().indexOf("listening") > -1){

															// LISTENING: to manage the starting of tcpkill (listening on port 8181)
															logger.debug('[WAMP-RECOVERY] ... tcpkill['+tcpkill_pid+'] listening...');

															//tcpkill_pid = tcpkill.pid;
															//logger.debug('[WAMP-RECOVERY] ... tcpkill -9 port 8181 - PID ['+tcpkill_pid+']');

														}else if (data.toString().indexOf("win 0") > -1){

															// TCPKILL DETECTED WAMP ACTIVITY (WAMP reconnection attempts)
															// This is the stage triggered when the WAMP socket was killed by tcpkill and WAMP reconnection process automaticcally started:
															// in this phase we need to kill tcpkill to allow WAMP reconnection.
															try{

																logger.debug('[WAMP-RECOVERY] ... killing tcpkill process with PID: ' + tcpkill_pid);
																process.kill(tcpkill_pid);


															}catch (e) {

																logger.error('[WAMP-RECOVERY] ... tcpkill killing error: ', e);

															}
															/*
															tcpkill.kill('SIGINT');


															//double check: It will test after a while if the tcpkill process has been killed
															setTimeout(function(){

																if ( running(tcpkill_pid) || tcpkill_pid == null){

																	tcpkill_kill_count = tcpkill_kill_count + 1;

																	logger.warn("[WAMP-RECOVERY] ... tcpkill still running!!! PID ["+tcpkill_pid+"]");
																	logger.debug('[WAMP-RECOVERY] ... tcpkill killing retry_count '+ tcpkill_kill_count);

																	tcpkill.kill('SIGINT');

																}

															}, 3000);
															*/

														}


													});


													tcpkill.on('close', function (code) {

														logger.debug('[WAMP-RECOVERY] ... tcpkill killed!');
														logger.info("[WAMP-RECOVERY] - WAMP socket cleaned!");

														//The previous WAMP socket was KILLED and the automatic WAMP recovery process will start
														//so the connection recovery is completed and "online" flag is set again to TRUE
														online = true;

													});


												}else{

													logger.warn('[WAMP-RECOVERY] ...tcpkill already started!');

												}

											}


										}, 2 * 1000);  //time to wait for WAMP alive message response

									}


								}
								catch(err){
									logger.warn('[CONNECTION-RECOVERY] - Error keeping alive wamp connection: '+ err);
								}

							}

						});


					}, 10 * 1000);

					logger.debug('[WAMP] - TIMER to keep alive WAMP connection set up!');

					//----------------------------------------------------------------------------------------------------


				};

				//-------------------------------
				// 4. On WAMP connection close
				//-------------------------------
				//This function is called if there are problems with the WAMP connection
				wampConnection.onclose = function (reason, details) {

					try{

						wamp_check = true;  // IMPORTANT: for ethernet connections this flag avoid to start recovery procedure (tcpkill will not start!)

						logger.error('[WAMP] - Error in connecting to WAMP server!');
						logger.error('- Reason: ' + reason);
						logger.error('- Reconnection Details: ');
						logger.error("  - retry_delay:", details.retry_delay);
						logger.error("  - retry_count:", details.retry_count);
						logger.error("  - will_retry:", details.will_retry);

						if(wampConnection.isOpen){
							logger.info("[WAMP] - connection is open!");
						}
						else{
							logger.warn("[WAMP] - connection is closed!");
						}

					}
					catch(err){
						logger.warn('[WAMP] - Error in WAMP connection: '+ err);
					}


				};


				//--------------------------------------------------------------
				// 2. The selected device will connect to Iotronic WAMP server
				//--------------------------------------------------------------
				switch(device){

					case 'arduino_yun':
						logger.info("[SYSTEM] - Lightning-rod Arduino Yun starting...");
						var yun = require('./device/arduino_yun');
						yun.Main(wampConnection, logger);
						break;

					case 'server':
						logger.info("[SYSTEM] - Lightning-rod server starting...");
						var server = require('./device/server');
						server.Main(wampConnection, logger);
						break;

					case 'raspberry_pi':
						logger.info("[SYSTEM] - Lightning-rod Raspberry Pi starting...");
						var raspberry_pi = require('./device/raspberry_pi');
						raspberry_pi.Main(wampConnection, logger);
						break;
						
					case 'android':
						logger.info("[SYSTEM] - L-R Android starting...");
						var yun = require('./device/android');
						yun.Main(wampConnection, logger);
						break;

					default:
						logger.warn('[SYSTEM] - Device "' + device + '" not supported!');
						logger.warn('[SYSTEM] - Supported devices are: "server", "arduino_yun", "raspberry_pi".');
						process.exit();
						break;

				}



			}


		});





























	}
	
});




