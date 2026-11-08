import 'server-only';
import {getMapBoundaries} from './mapProfileRepository';
import {createDistrictMatcher,districtNeighbours} from './districtPages';

// The boundary file only changes with a deploy, so its derived indexes are built once per server.
let indexes=null;
export function getDistrictIndexes(){
 indexes??=getMapBoundaries().then(boundaries=>({neighbours:districtNeighbours(boundaries),matcher:createDistrictMatcher(boundaries)})).catch(error=>{indexes=null;throw error;});
 return indexes;
}
