import MemberPage from '@/app/components/member-page';
export default async function Member({params}:{params:Promise<{id:string}>}){const {id}=await params;return <MemberPage id={id}/>;}
