type IllustrationKind = 'clients' | 'business' | 'institution'

/** Small decorative vectors stay sharp without adding image downloads. */
export default function ClientCardIllustration({ kind }: { kind: IllustrationKind }) {
    return (
        <svg aria-hidden="true" focusable="false" viewBox="0 0 180 100" fill="none" className="h-full w-full">
            <circle cx="126" cy="47" r="43" fill="currentColor" opacity=".045" />
            <circle cx="126" cy="47" r="34" stroke="currentColor" strokeOpacity=".08" />
            <path d="M37 87H169" stroke="currentColor" strokeOpacity=".15" strokeLinecap="round" />
            <circle cx="53" cy="29" r="3" fill="currentColor" opacity=".15" />
            <path d="M161 18v6m-3-3h6M40 65v6m-3-3h6" stroke="currentColor" strokeOpacity=".25" strokeLinecap="round" />
            {kind === 'clients' && <>
                <path d="M76 46L111 32L144 49M76 46L109 72L144 49" stroke="currentColor" strokeOpacity=".2" strokeDasharray="3 4" />
                <rect x="59" y="32" width="35" height="43" rx="9" fill="white" stroke="currentColor" strokeOpacity=".16" />
                <circle cx="76.5" cy="45" r="6" fill="currentColor" opacity=".2" />
                <path d="M66 65v-3a10.5 10.5 0 0121 0v3" fill="currentColor" opacity=".14" />
                <rect x="127" y="38" width="33" height="41" rx="9" fill="white" stroke="currentColor" strokeOpacity=".16" />
                <circle cx="143.5" cy="51" r="5.5" fill="currentColor" opacity=".2" />
                <path d="M134 70v-3a9.5 9.5 0 0119 0v3" fill="currentColor" opacity=".14" />
                <rect x="88" y="19" width="44" height="59" rx="11" fill="white" stroke="currentColor" strokeOpacity=".3" />
                <circle cx="110" cy="37" r="8" fill="currentColor" opacity=".35" />
                <path d="M96 63v-5a14 14 0 0128 0v5" fill="currentColor" opacity=".22" />
                <path d="M101 69h18" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" strokeLinecap="round" />
                <circle cx="131" cy="75" r="10" fill="white" stroke="currentColor" strokeOpacity=".25" />
                <path d="m127 75 3 3 5-6" stroke="currentColor" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </>}
            {kind === 'business' && <>
                <path d="M60 86V43l26-10v53" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeOpacity=".2" strokeLinejoin="round" />
                <path d="M86 86V23l37-10v73" fill="white" stroke="currentColor" strokeOpacity=".3" strokeLinejoin="round" />
                <path d="m123 13 17 12v61h-17" fill="currentColor" fillOpacity=".13" stroke="currentColor" strokeOpacity=".2" strokeLinejoin="round" />
                {[32, 44, 56].map((y) => <path key={y} d={`M95 ${y}h5m9-3h5`} stroke="currentColor" strokeOpacity=".3" strokeWidth="4" />)}
                <path d="M68 51h8m-8 11h8m-8 11h8M129 34h5m-5 12h5m-5 12h5" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
                <path d="M100 86V73h11v13" fill="currentColor" opacity=".18" />
                <path d="M151 87V70" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
                <ellipse cx="151" cy="66" rx="8" ry="12" fill="currentColor" opacity=".16" />
            </>}
            {kind === 'institution' && <>
                <path d="M68 49h83v34H68z" fill="white" stroke="currentColor" strokeOpacity=".22" />
                <path d="m61 49 48-24 49 24H61Z" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeOpacity=".3" strokeLinejoin="round" />
                <circle cx="109" cy="40" r="4" fill="white" stroke="currentColor" strokeOpacity=".3" />
                {[76, 98, 120, 142].map((x) => <path key={x} d={`M${x} 56v21`} stroke="currentColor" strokeOpacity=".18" strokeWidth="6" />)}
                <path d="M64 82h91v5H64z" fill="currentColor" opacity=".18" />
                <path d="M109 25V10m0 0h17l-4 5 4 5h-17" stroke="currentColor" strokeOpacity=".35" strokeLinejoin="round" />
                <path d="M54 86V72" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
                <path d="m54 55-9 20h18L54 55Z" fill="currentColor" opacity=".16" />
            </>}
        </svg>
    )
}
