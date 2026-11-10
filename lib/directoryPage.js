import {collectionDefaults,readListState} from './listState.js';
import {filterInstitutions,institutionDetailsMap,institutionIndexItems} from './institutionDirectories.js';
import {pickDetails,versionedDetails} from './deferredDetails.js';

// Props for InstitutionDirectory: light rows for every record, details for the cards the first
// screen shows (default view and the filters in the address), and the versioned details URL.
const pageSize=12;
export function directoryProps(items,kind,searchParams={}){
 const index=institutionIndexItems(items,kind);
 const {details,version}=versionedDetails(items,rows=>institutionDetailsMap(rows,kind));
 const full=index.map(item=>({...item,...details[item.id]}));
 const defaults=kind==='medical'?collectionDefaults.medicalCenters:collectionDefaults.universities;
 const query=new URLSearchParams(Object.entries(searchParams||{}).flatMap(([key,value])=>(Array.isArray(value)?value:[value]).map(item=>[key,String(item)])));
 const state=readListState('?'+query.toString(),defaults);
 const firstPage=filterInstitutions(full,defaults,kind).slice(0,pageSize);
 const results=filterInstitutions(full,state,kind),page=Math.min(state.page,Math.max(1,Math.ceil(results.length/pageSize)));
 const fromAddress=results.slice((page-1)*pageSize,page*pageSize);
 return {items:index,details:pickDetails(details,[...firstPage,...fromAddress].map(item=>item.id)),
  detailsUrl:'/api/directories/details?kind='+(kind==='medical'?'medical-centers':'universities')+'&v='+version};
}
