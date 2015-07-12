'use strict';

var rx = require('rx');
var http = require('http');
var fs = require('fs');

var SERVICE_PORT = process.env.SERVICE_PORT || 8765;
var groups = ['green', 'blue', 'red'];

var publish = new rx.Subject();
var simSource = rx.Observable.interval(2000)
							.map(function(x){
								return {
									sequence: x,
									group: groups[getRandomInt(0,3)]
								};
							})
							.merge(publish)
							.publish()
							.refCount();

var grouped = simSource							
							.scan({}, function (acc, x) {
								if(!acc[x.group]) acc[x.group] = 0;
								acc[x.group] += 1;
								acc.sequence = x.sequence || acc.sequence;
								delete acc.group;
								return acc;
							})
							.publish()
							.refCount();

var server = http
							.createServer()
							.listen(SERVICE_PORT, function(){
								console.log('Listen on: ' + SERVICE_PORT);
							});

server.on('request', function(req, res){
	var route = router(req, res);

	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('Transfer-Encoding', 'chunked');

	route.get(/\//, function(req, res){
		res.setHeader('Content-Type', 'text/html');
		fs.createReadStream('index.html')
			.pipe(res);
	});

	route.get(/\/subscribe\/([a-z]*)/, function(req, res){
		console.log('New source stream subscription: ' + req.params[0]);

		var subscription = grouped
			.map(function(data){
				if(req.params[0]){
					var result = {};
					result[req.params[0]] = data[req.params[0]];
					return result;
				} 
				return data;
			})
			.doAction(function(data){
				res.write(JSON.stringify(data) + '\n\n');
			})
			.subscribe();

			req.on('close', function(){
				console.log('Stream subscription closed');
				
				subscription.dispose();
			});
	});

	route.post(/\/publish\/([a-z]*)/, function(req, res){
		console.log('New event to stream: ' + req.params[0]);

		publish.onNext({
			group: req.params[0]
		});
		res.end();
	});

	route.get(/\/log/, function(req, res){
		console.log('New log stream subscription: ');

		var subscription = simSource
			.doAction(function(data){
				res.write(JSON.stringify(data) + '\n\n');
			})
			.subscribe();

			req.on('close', function(){
				console.log('Stream subscription closed');
				
				subscription.dispose();
			});
	});

});

function router(req, res){
	req.params = {};

	return {
		get: function(route, cb){
			if(req.method !== 'GET') return;
			this.all('GET', route, cb);
		},
		post: function(route, cb){
			if(req.method !== 'POST') return;
			this.all('POST', route, cb);			
		},
		all: function(verb, route, cb){
			if(req.method !== verb) return;
			var matches = req.url.match(route);
			
			if(!matches) return;
			if(matches[0] !== matches.input) return;

			req.params[0] = matches[1];
			req.params[1] = matches[2];
			cb(req, res);			
		}
	};
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}