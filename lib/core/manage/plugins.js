/*
 *				 Apache License
 *                           Version 2.0, January 2004
 *                        http://www.apache.org/licenses/
 *
 *      Copyright (c) 2014 2015 2016 Dario Bruneo, Francesco Longo, Giovanni Merlino,
 *      Andrea Rocco Lotronto, Arthur Warnier, Nicola Peditto, Kostya Esmukov
 *
 */
"use strict";

var logger = require('../../utils/log4js-wrapper').getLogger("manage plugins");
var Board = require('../board');


//If I'm connected to the WAMP server I can receive plugins to be scheduled as RPCs
//var managePlugins = require('./manage-plugins');
//managePlugins.exportPluginCommands(session);


/**
 * Exports procedures and subscribes to topics for the session
 * @param session {BaseWAMPSession}
 */
module.exports = function (session) {

};