// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as http from 'http';

import * as Promise from 'bluebird';

import { WxHandler, WxHandlerOptions } from './WxHandler';

export class WxServer {
	constructor(public options: WxHandlerOptions = {}) {
		const handler = new WxHandler(options);

		this.handler = handler;
		this.server = http.createServer(
			(
				req: http.IncomingMessage,
				res: http.ServerResponse
			) => handler.tryHandle(req, res)
		);
	}

	/** Bind the server to a port. */

	listen(port: number) {
		return(new Promise((resolve: () => void, reject: (err: NodeJS.ErrnoException) => void) =>
			this.server.listen(port, resolve).on('error', reject)
		));
	}

	handler: WxHandler;
	server: http.Server;
}
