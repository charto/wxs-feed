// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as Promise from 'bluebird';

import { WxState } from '../WxHandler';
import { WxError, WxErrorCode } from '../WxError';

export interface WfsDescribeFeatureType {
	namespace: string;
	name: string;
	imports?: { namespace: string, location: string }[];
	fields?: { name: string, type: string, optional: boolean }[];
}

export function wfsDescribeFeatureType(state: WxState) {
	const handler = state.options.describeFeatureType;

	if(!handler) {
		throw(new WxError(WxErrorCode.unsupportedOperation, 'DescribeFeatureType'));
	}

	const typeName = state.paramTbl!['typename'];

	if(!typeName) {
		throw(new WxError(WxErrorCode.missingParameter, 'typeName'));
	}

	const handled = Promise.try(handler(state, typeName)).then((spec: WfsDescribeFeatureType) => {
		let output = '';
		let target: string | undefined;

		output = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<xsd:schema',
			' xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
			' targetNamespace="' + spec.namespace + '"',
			' elementFormDefault="qualified"',
			' version="1.0"',
			'>',
			'<xs:import',
			' namespace="http://www.opengis.net/gml"',
			' schemaLocation="http://schemas.opengis.net/gml/3.1.1/base/gml.xsd"',
			'/>',

			!spec.imports ? '' : spec.imports.map(
				(importSpec) => (
					importSpec.namespace == spec.namespace ? [
						'<xsd:include',
						' schemaLocation="' + importSpec.location + '"',
						'/>'
					] : [
						'<xs:import',
						' namespace="' + importSpec.namespace + '"',
						' schemaLocation="' + importSpec.location + '"',
						'/>',
					]
				).join('')
			).join(''),

			!spec.fields ? '' : [
				'<xs:complexType name="FeatureType">',
				'<xs:complexContent>',
				'<xs:extension base="gml:AbstractFeatureType">',
				'<xs:sequence>',
				spec.fields.map(
					(fieldSpec) => [
						'<xs:element',
						fieldSpec.optional ? [
							' maxOccurs="1"',
							' minOccurs="0"',
							' nillable="true"'
						].join('') : '',
						' name="', fieldSpec.name, '"',
						' type="', fieldSpec.type, '"',
						'/>'
					].join('')
				).join(''),
				'</xs:sequence>',
				'</xs:extension>',
				'</xs:complexContent>',
				'</xs:complexType>',
				'<xs:element name="' + spec.name + '" substitutionGroup="gml:_Feature" type="FeatureType"/>'
			].join(''),

			'</xsd:schema>'
		].join('');

		state.handler.sendString(state, 200, 'text/xml; subtype=gml/3.1.1', output);
	});

	return(handled);
}
