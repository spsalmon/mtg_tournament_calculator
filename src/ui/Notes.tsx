const MTR_URL = 'https://blogs.magicjudges.org/rules/mtr/';

interface NotesProps {
  readonly intentionalDraws: boolean;
}

export default function Notes({ intentionalDraws }: NotesProps) {
  return (
    <section className="flex flex-col gap-4 border-t border-slate-800 pt-4 text-xs leading-relaxed text-slate-400">
      <p>
        <span className="font-semibold text-slate-300">Assumptions.</span> Standard Swiss pairing
        inside point brackets; no repeat-pairing avoidance; nobody drops mid-event; no awarded byes
        beyond the single bye an odd field needs; every match 50/50 between equally-skilled players.
        No tiebreakers are modelled, so at the cut line itself OMW% decides and this tool does not
        know it.
      </p>

      {intentionalDraws && (
        <p>
          <span className="font-semibold text-slate-300">
            Simulated players draw out as soon as drawing every remaining round still makes the cut.
          </span>{' '}
          Being locked is decided by a worst case over the rounds left: the next round's pairings
          are known from the standings, and after that anyone may beat anyone. That worst case is
          deliberately generous to the field, so the tool draws later than a real player might. It
          also counts only players who would finish strictly ahead, which makes it optimistic when a
          whole bracket draws into a tie for the last few slots.
        </p>
      )}

      <p>
        <span className="font-semibold text-slate-300">
          Intentional draws are legal in the Swiss rounds of most events, but never in the
          single-elimination top cut.
        </span>{' '}
        Offering any incentive to induce a result — cards, cash, a prize split — is bribery, and it
        gets people disqualified. See the{' '}
        <a
          href={MTR_URL}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted hover:text-slate-200"
        >
          Magic Tournament Rules
        </a>
        .
      </p>
    </section>
  );
}
