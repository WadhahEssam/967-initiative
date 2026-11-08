import {shareCardPath} from '@/lib/shareCard';
import {notFound} from 'next/navigation';
import InstitutionDetail from '@/components/InstitutionDetail';
import {getMedicalCenter,getMedicalCenters} from '@/lib/data';
import {relatedInstitutions} from '@/lib/institutionDirectories';
import {detailPath,pageMetadata} from '@/lib/seo';
import {breadcrumbSchema,institutionSchema,JsonLd} from '@/lib/seo-schema';

export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {slug}=await params,item=await getMedicalCenter(slug);if(!item)notFound();return pageMetadata({title:`${item.name} | دليل المراكز الطبية`,description:item.summary,path:detailPath('medical-centers',item.id),image:shareCardPath('medical',item.id,item.name,item.summary,item.specialties?.length)});}
export default async function MedicalCenterPage({params}){const {slug}=await params,item=await getMedicalCenter(slug);if(!item)notFound();const all=await getMedicalCenters();return <><JsonLd data={breadcrumbSchema([{name:'دليل المراكز الطبية',path:'/medical-centers'},{name:item.name,path:detailPath('medical-centers',item.id)}])}/><JsonLd data={institutionSchema(item,'medical')}/><InstitutionDetail kind="medical" item={item} related={relatedInstitutions(item,all,'medical')}/></>;}
