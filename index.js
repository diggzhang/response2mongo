"use strict";

/*
 * on-finished - execute a callback when a request closes, finishes, or errors
 * mongoose    - mongodb driver
 */
const onFinished = require("on-finished");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Mixed = Schema.Types.Mixed;

const mongooseOpt = {
    server: {
        socketOptions: {keepAlive: 1},
        poolSize: 100
    }
};

const logSchema = {
    url: {type: String},
    request: {type: Mixed},
    response: {type: Mixed},
    method: {type: String},
    status: {type: Number}
};

//mongoose.connect(loggerInstance.logmongolink, mongooseOpt);

/*
 * Koa middleware layer, adds this.log property to koa context
 * and this.log contain log's mongodb config
 *
 *
 * Parameters:
 *      - loggerInstance Ref:[node-bunyan#Constructor API](https://github.com/trentm/node-bunyan)
 *
 * How to require:
 * const log2mongo = require('log2mongo');
 * const appLoggerTag = bunyan.createLogger({name:'onionsLog', mongoHost       : '127.0.0.1',
 *                                                             mongoDB         : 'testLog',
 *                                                             mongoPort       : 27017,
 *                                                             mongoCollection : 'logs'})
 * app
 *     .use(log2mongo(appLoggerTag))
 *     .use(log2mongo.logSniffer())
 */
module.exports = function (mongoInstance) {
    mongoose.connect(mongoInstance.host + ':' + mongoInstance.port + '/' + mongoInstance.db, mongooseOpt);
    let model = mongoose.model('log', logSchema);
    return model
};

module.exports.logSniffer = function (model) {

    return function *logSniffer(next) {
        let err;

        let onResponseFinished = function () {

           let logMsg = {
               url: this.request.href,
               request: this.request.body,
               response: this.response.body,
               method: this.request.method,
               status: this.status
           };

           let log = new model(logMsg);
           log.save(function (err) {
               if (err) {
                   console.error(err);
               }
               logMsg = null;
           });
        };


        try {
            yield *next;
        } catch(e) {
            err = e;
        }finally {
            onFinished(this.response.res, onResponseFinished.bind(this));
        }

        if (err) {
            throw new err;
        }
    };
};

mongoose.connection.on('connected', () => {
    console.info('log database connected');
});

mongoose.connection.on('error', function (err) {
    console.error("log db error: " + err);
    process.exit(1);
});

mongoose.connection.on('disconnected', function () {
    console.error('log database disconnected');
    process.exit(1);
});

process.on('SIGINT', function () {
    if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
        console.log("log database closed");
    } else {
        process.exit(0);
    }
});
