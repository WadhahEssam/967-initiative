import PostListingWizard from '@/components/market/PostListingWizard';
import {getMarketPlaces} from '@/lib/market/places';
import {pageMetadata} from '@/lib/seo';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'أضف إعلانًا | سوق 967',description:'انشر إعلانك مجانًا في سوق 967 في أقل من دقيقة.',path:'/market/new',noindex:true});

export default async function NewListingPage(){
 const places=await getMarketPlaces();
 return <PostListingWizard places={places}/>;
}
