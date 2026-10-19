import Link from 'next/link';
import type {Challenge} from '@/lib/challenge';
import PrizeMedal from './prize-medal';
import CaptionPhoto from './caption-photo';
import Sticker from './sticker';

export default function ChallengePanel({challenge,closed=false,enterHref,overview=false}:{
 challenge:Challenge|null;closed?:boolean;enterHref?:string;overview?:boolean;
}) {
 if(overview&&challenge)return <div className="weekly-challenge-panel challenge-overview challenge-banner-wrap">
  <section className="challenge-banner" aria-labelledby="challenge-banner-title">
   <h2 id="challenge-banner-title" className="folder-tab challenge-panel-tab">The weekly club challenge</h2>
   <div className="challenge-banner-art" aria-hidden="true"><Sticker kind="laugh"/><div className="challenge-banner-medals"><PrizeMedal place={1}/><PrizeMedal place={2}/><PrizeMedal place={3}/></div></div>
   <p className="challenge-banner-copy">Make them laugh.<span>Win extra credits.</span></p>
   {enterHref&&!closed&&<Link className="pill-button challenge-banner-enter" href={enterHref}>Enter challenge</Link>}
  </section>
 </div>;
 const Heading=overview?'h2':'h1';
 const introduction=<div className="challenge-heading"><p className="challenge-intro">Create a caption for this week’s theme. Collect likes and win extra generation credit.</p></div>;
 return <div className="weekly-challenge-panel challenge-overview">
  <section className="challenge-hero details-card" aria-label="Weekly challenge">
   <Heading className="folder-tab challenge-panel-tab">The weekly club challenge</Heading>
   {introduction}
   {challenge?<>
    <div className="challenge-prizes" aria-label="Challenge prizes">
     <div><PrizeMedal place={1}/><div className="prize-copy"><strong>1 winner</strong><span>+3 credits</span></div></div>
     <div><PrizeMedal place={2}/><div className="prize-copy"><strong>3 winners</strong><span>+2 credits each</span></div></div>
     <div><PrizeMedal place={3}/><div className="prize-copy"><strong>10 winners</strong><span>+1 credit each</span></div></div>
    </div>
    <h2>Weekly Theme: {challenge.title}</h2><p>{challenge.theme}</p>
    {challenge.image_url&&<div className="challenge-image"><CaptionPhoto src={challenge.image_url} alt="This week's challenge image"/></div>}
    {enterHref&&!closed&&<Link className="pill-button challenge-enter-button" href={enterHref}>Enter challenge ↗</Link>}
   </>:<><h2>The next challenge is on its way.</h2><p>Explore captions while the club prepares this week’s theme.</p><Link className="pill-button" href="/explore">Explore captions ↗</Link></>}
  </section>
 </div>;
}
