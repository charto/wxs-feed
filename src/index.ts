// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

export { WxHandler, WxState, guessEndpoint } from './WxHandler';
export { WxServer } from './WxServer';

export { WxError, WxErrorCode } from './WxError';

export { WfsGetCapabilities } from './wfs/getCapabilities';
export { WfsDescribeFeatureType } from './wfs/describeFeatureType';
export { WfsGetFeatureSpec, WfsGetFeature } from './wfs/getFeature';

export { WmsGetCapabilities } from './wms/getCapabilities';
export { WmsGetMapSpec, WmsGetMap } from './wms/getMap';

export { WmtsGetCapabilities } from './wmts/getCapabilities';
export { WmtsGetTileSpec} from './wmts/getTile';
