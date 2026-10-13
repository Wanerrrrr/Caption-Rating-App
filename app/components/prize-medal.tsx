export default function PrizeMedal({place}:{place:1|2|3}) {
    const fill = {1:'#f5ce61',2:'#d4d9e6',3:'#cc986b'}[place];
    const label = {1:'Gold medal',2:'Silver medal',3:'Bronze medal'}[place];
    return <svg className="prize-medal" viewBox="0 0 32 42" role="img" aria-label={label}>
        <path d="M7 2h7l8 15-6 5L7 2Z" fill="#b2a8ec" stroke="#17152f" strokeWidth="1.7" strokeLinejoin="round"/>
        <path d="M18 2h7l-9 20-6-5L18 2Z" fill="#eab2cf" stroke="#17152f" strokeWidth="1.7" strokeLinejoin="round"/>
        <circle cx="16" cy="27" r="12" fill={fill} stroke="#17152f" strokeWidth="1.7"/>
        <circle cx="16" cy="27" r="8.5" fill="none" stroke="#17152f" strokeWidth="1" opacity=".35"/>
        <path d="m16 21 1.8 3.7 4.2.6-3 2.9.7 4.1-3.7-2-3.7 2 .7-4.1-3-2.9 4.2-.6Z" fill="#fff8e3" stroke="#17152f" strokeWidth="1" strokeLinejoin="round"/>
    </svg>;
}
