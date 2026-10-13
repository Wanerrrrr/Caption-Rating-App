import MemberPage from '../components/member-page';
export default async function Me({searchParams}:{searchParams:Promise<{connections?:string}>}){const {connections}=await searchParams;return <MemberPage connections={connections}/>;}
