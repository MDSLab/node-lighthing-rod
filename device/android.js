exports.Main = function (wampConnection, logger){

    // CONNECTION TO WAMP SERVER --------------------------------------------------------------------------
    logger.info('[WAMP-STATUS] - Opening connection to WAMP server...');
    wampConnection.open();
    //-----------------------------------------------------------------------------------------------------

    // PLUGINS RESTART ALL --------------------------------------------------------------------------------
    //This procedure restarts all plugins in "ON" status
    var managePlugins = require('../manage-plugins');
    managePlugins.pluginsLoader();
    //-----------------------------------------------------------------------------------------------------

} 
