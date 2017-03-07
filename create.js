module.exports = function(RED) {

  var elasticsearch = require('elasticsearch');
  
  //reuse pooled client to avoid create too many tcp connection to es server
  var esClientPool = function () {
    var clients = {};
    var obj = {
      get: function (hosts) {
        var id = hosts;
        console.log("hosts", hosts);
        if (!clients[id]) {
          clients[id] = new elasticsearch.Client({
            hosts: hosts.split(' ')
            // timeout: timeout,
            // requestTimeout: requestTimeout
            // log: 'trace'
          });
          clients[id]._id = id;
          clients[id]._nodeCount = 0;
        }
        clients[id]._nodeCount += 1;
        return clients[id];
      },
      close: function (client) {
        client._nodeCount -= 1;
        if (client._nodeCount === 0) {
          delete clients[client._id];
        }
      }
    };
    return obj;
  }();

  
  function Create(config) {
    RED.nodes.createNode(this,config);
    this.server = RED.nodes.getNode(config.server);
    var node = this;
    this.on('input', function(msg) {
      //will get client from  pool
      var client = esClientPool.get(node.server.host);

      var documentIndex = config.documentIndex;
      var documentType = config.documentType;

      // check for overriding message properties
      if (msg.hasOwnProperty("documentIndex")) {
        documentIndex = msg.documentIndex;
      }
      if (msg.hasOwnProperty("documentType")) {
        documentType = msg.documentType;
      }

      // construct the search params
      var params = {
        index: documentIndex,
        type: documentType,
        id: msg.documentId,
        body: msg.payload
      };

      //change create(...) to index(...) for auto-id after ES V5.0
      client.index(params).then(function (resp) {
        msg.payload = resp;
        node.send(msg);
      }, function (err) {
        node.error(err);
      });

    });
  }
  RED.nodes.registerType("es-create",Create);
};
