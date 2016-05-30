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

var fs = require("fs");
var log4js = require('log4js');

var log4jsWrapper = require('./lib/utils/log4js-wrapper');
var nconfWrapper = require('./lib/utils/nconf-wrapper');
var ConfigError = require('./lib/utils/config-error');

var Board = require('./lib/core/board');
var Reverse = require('./lib/core/reverse');
var Socat = require('./lib/core/socat');
var WAMP = require('./lib/core/wamp');

var logger = log4jsWrapper.getLogger("main");
var nconf = nconfWrapper.nconf;


nconfWrapper.reload();
log4jsWrapper.reload(nconf);

try {
    Reverse.getState().reload();
    Socat.getState().reload();

    Board.getState().reload();
    WAMP.getState().reload();

    logger.info('##############################');
    logger.info('  Stack4Things Lightning-rod');
    logger.info('##############################');

    Board.getState().getDevice().init()
        .then(function() {
            WAMP.getState().connect();

            // todo
            //var managePlugins = require('./manage-plugins');
            ////managePlugins.restartAllActivePlugins();  //DEPRECATED
            //managePlugins.pluginsLoader();

            //var driversManager = require("./manage-drivers");
            ////driversManager.mountAllEnabledDrivers();

        })
        .catch(function(error) {
            // todo logging message
            throw error;
        });
}
catch(e) {
    if (e instanceof ConfigError) {
        throw e; // todo custom log message
    }
    throw e;
}
