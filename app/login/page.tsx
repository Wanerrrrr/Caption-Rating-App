import SiteFrame from '../components/site-frame';
import GoogleSignIn from './google-sign-in';
export default function LoginPage(){
 return <SiteFrame active="login"><section className="login-card"><h1>Sign in</h1><GoogleSignIn/></section></SiteFrame>;
}
