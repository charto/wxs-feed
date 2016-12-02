// This file is part of wxs-feed, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as http from 'http';

export function handleWxS(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	options?: any
) {
	if(!options) options = {};
	const encoding = options.encoding || 'utf-8';

	console.log(req.url);

	const body = '<?xml version="1.0" encoding="' + encoding + '"?>';

	const data = new Buffer(body, encoding);

	res.writeHead(200, {
		'Content-Type': 'text/xml; subtype=gml/3.1.1',
		'Content-Length': data.length,
		'Cache-Control': 'private'
	});

	res.end(data);
}
