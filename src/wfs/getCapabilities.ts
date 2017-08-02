// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as Promise from 'bluebird';

import { WxState } from '../WxHandler';
import { WxError, WxErrorCode } from '../WxError';
import { BBox } from '../types/BBox';

export interface WfsLayer {
	name: string;
	title?: string;
	srs?: any;
}

export interface NamespaceRef {
	prefix: string;
	uri: string;
}

export interface WfsGetCapabilities {
	title?: string;
	endpoint?: string;
	srs?: string;
	bbox4326?: BBox,
	namespaces?: NamespaceRef[];
	layers?: WfsLayer[];
}

export function wfsGetCapabilities(state: WxState) {
	const handler = state.options.wfs && state.options.wfs.getCapabilities;

	if(!handler) {
		throw(new WxError(WxErrorCode.unsupportedOperation, 'GetCapabilities'));
	}

	const handled = Promise.try(() => handler(state)).then((spec: WfsGetCapabilities | null) => {
		if(!spec) {
			throw(new WxError(WxErrorCode.unsupportedOperation, 'GetCapabilities'));
		}

		let endpoint = spec.endpoint;
		const bbox = spec.bbox4326;

		if(!endpoint) {
			endpoint = [
				state.req.headers['X-Forwarded-Protocol'] || 'http',
				'://',
				state.req.headers.host,
				state.req.url!.substr(0, state.paramStart)
			].join('');
		}

		const output = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<WFS_Capabilities',
			' xmlns="http://www.opengis.net/wfs"',
			' xmlns:ows="http://www.opengis.net/ows"',
			' xmlns:ogc="http://www.opengis.net/ogc"',
			' xmlns:xlink="http://www.w3.org/1999/xlink"',
			' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
			(spec.namespaces || []).map(
				(ns: NamespaceRef) => ' xmlns:' + ns.prefix + '="' + ns.uri + '"'
			).join(''),
			' xsi:schemaLocation="http://www.opengis.net/wfs"',
			' version="1.1.0"',
			'>',

			'<ows:ServiceIdentification>',
			!spec.title ? '' : '<ows:Title>' + spec.title + '</ows:Title>',
			'<ows:ServiceType>WFS</ows:ServiceType>',
			'<ows:ServiceTypeVersion>1.1.0</ows:ServiceTypeVersion>',
			'</ows:ServiceIdentification>',

			'<ows:OperationsMetadata>',
			['GetCapabilities', 'DescribeFeatureType', 'GetFeature'].map(
				(operation: string) => !state.options.wfs || !state.options.wfs[
					operation.charAt(0).toLowerCase() + operation.substr(1)
				] ? '' : [
					'<ows:Operation name="' + operation + '">',
					'<ows:DCP><ows:HTTP>',
					'<ows:Get xlink:href="' + endpoint + '"/>',
					'<ows:Post xlink:href="' + endpoint + '"/>',
					'</ows:HTTP></ows:DCP>',
					'</ows:Operation>'
				].join('')
			).join(''),
			'</ows:OperationsMetadata>',

			'<FeatureTypeList>',
			'<Operations>',
			'<Operation>Query</Operation>',
			'</Operations>',
			!spec.layers ? '' : spec.layers.map(
				(layer: WfsLayer) => [
					'<FeatureType>',
					'<Name>', layer.name, '</Name>',
					'<Title>', layer.title || layer.name, '</Title>',
					'<DefaultSRS>', (
						(typeof(layer.srs) == 'string' && layer.srs) ||
						spec.srs ||
						'EPSG:4326'
					), '</DefaultSRS>',
					!bbox ? '' : [
						'<ows:WGS84BoundingBox>',
						'<ows:LowerCorner>' + bbox[0] + ' ' + bbox[1] + '</ows:LowerCorner>',
						'<ows:UpperCorner>' + bbox[2] + ' ' + bbox[3] + '</ows:UpperCorner>',
						'</ows:WGS84BoundingBox>'
					].join(''),
					'</FeatureType>'
				].join('')
			).join(''),
			'</FeatureTypeList>',

			'<ogc:Filter_Capabilities>',
			'<ogc:Spatial_Capabilities>',
			'<ogc:GeometryOperands>',
			'<ogc:GeometryOperand>gml:Envelope</ogc:GeometryOperand>',
			'</ogc:GeometryOperands>',
			'<ogc:SpatialOperators>',
			'<ogc:SpatialOperator name="BBOX" />',
			'<ogc:SpatialOperator name="Intersects" />',
			'</ogc:SpatialOperators>',
			'</ogc:Spatial_Capabilities>',
			'<ogc:Id_Capabilities>',
			'<ogc:EID />',
			'<ogc:FID />',
			'</ogc:Id_Capabilities>',
			'</ogc:Filter_Capabilities>',

			'</WFS_Capabilities>'
		].join('');

		state.handler.sendString(state, 200, 'text/xml; subtype=gml/3.1.1', output);
	});

	return(handled);
}
