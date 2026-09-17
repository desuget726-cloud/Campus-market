const policyContent = {
    terms: {
        eyebrow: 'Legal',
        title: 'Terms of Service',
        intro: 'These terms explain the rules for using DG Market and participating in campus transactions.',
        sections: [
            ['Using DG Market', 'Users must provide accurate account information and use the marketplace only for lawful campus exchanges.'],
            ['Accounts and safety', 'Keep your login details private. Report suspicious listings, messages, or account activity through the support form.'],
            ['Transactions', 'Buyers and sellers are responsible for confirming item condition, handover details, and transaction records before completing an exchange.'],
        ],
    },
    privacy: {
        eyebrow: 'Legal',
        title: 'Privacy Policy',
        intro: 'This placeholder explains how DG Market may collect, use, and protect information from campus users.',
        sections: [
            ['Information we collect', 'We may collect account, contact, listing, order, and support information needed to operate the marketplace.'],
            ['How information is used', 'Information is used to provide marketplace services, protect users, process transactions, and improve the campus experience.'],
            ['Your choices', 'You may contact support to ask questions about your information, account access, or privacy requests.'],
        ],
    },
    'refund-dispute': {
        eyebrow: 'Buyer protection',
        title: 'Refund / Dispute Policy',
        intro: 'This placeholder describes how DG Market will review disputes and escrow-related refund requests.',
        sections: [
            ['Open a dispute', 'Submit the order details, a clear description, and any screenshots or receipts through the support form as soon as an issue occurs.'],
            ['Review process', 'DG Market may contact both parties, review marketplace records, and hold or release escrow funds while the case is assessed.'],
            ['Resolution', 'Approved refunds, partial refunds, or fund releases will follow the final decision and the transaction evidence available to the marketplace team.'],
        ],
    },
};

function PolicyView({ type, onNavigate }) {
    const content = policyContent[type] || policyContent.terms;

    return (
        <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
            <div className="rounded-[28px] bg-sky-700 px-6 py-10 text-white shadow-xl sm:px-10">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-100">{content.eyebrow}</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{content.title}</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-blue-50">{content.intro}</p>
            </div>

            <div className="mt-6 grid gap-4">
                {content.sections.map(([heading, text]) => (
                    <article key={heading} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900">{heading}</h2>
                        <p className="mt-3 leading-7 text-slate-600">{text}</p>
                    </article>
                ))}
            </div>

            <button type="button" onClick={() => onNavigate?.('contact')} className="mt-7 rounded-full bg-sky-700 px-5 py-3 font-bold text-white transition hover:bg-sky-800">
                Contact support
            </button>
        </section>
    );
}

export default PolicyView;
