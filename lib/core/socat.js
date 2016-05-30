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


var nconf = require('nconf');

var ConfigError = require('./../utils/config-error');


var socatState = new SocatState();

/**
 * Socat subsystem state
 * Don't ever cache it's results, because they might be changed at any time.
 *
 * @constructor
 */
function SocatState() {
}


/**
 * Returns false if SocatState is not loaded yet
 *
 * @returns {boolean}
 */
SocatState.prototype.isLoaded = function () {
    // todo
    return true;
};


/**
 * Reloads Socat subsystem state
 *
 * @throws {ConfigError}
 * @param nconf_ might be omitted
 */
SocatState.prototype.reload = function (nconf_) {
    var nconf = nconf_ || nconf;

    // todo validate
    var socatPort = nconf.get('config:socat:client:port');

};

/**
 * Socat subsystem singleton
 */
var Socat = module.exports = {};

/**
 * Returns SocatState
 *
 * @returns {SocatState}
 */
Socat.getState = function () {
    return socatState;
};

