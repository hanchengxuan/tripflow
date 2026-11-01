import { useEffect, useRef, useState } from 'react';

import type { ItineraryItem } from '@/domain/models';
import { proposalsFromReply, sendTripChat, type TripChatMessage, type TripChatProposal, type TripChatReply } from '@/features/ai/trip-chat';
import type { ReceiptPhotoResult } from '@/features/ledger/receipt-photo';
import { toUserMessage } from '@/lib/user-error';

type Turn = TripChatMessage & { id: number; imageUri?: string; proposals?: TripChatProposal[]; run?: TripChatReply['run'] };
type Photo = Extract<ReceiptPhotoResult, { status: 'ok' }>['receipt'];

function messageFromTurn(turn: Turn): TripChatMessage {
  const statuses = turn.proposals?.map(({ action, status }) => {
    const target = action.type === 'update_plan' ? action.itemId : action.title.slice(0, 40);
    return `[${status}] ${action.type} ${target}`;
  }) ?? [];
  const statusContext = statuses.length ? `Proposal status (opened means a ledger draft, not saved):\n${statuses.join('\n')}\n` : '';
  return { role: turn.role, text: `${statusContext}${turn.text}`.slice(0, 600) };
}

export function useTripChat({ tripId, itineraryItems, memberIds, locale, tx }: {
  tripId?: string;
  itineraryItems: ItineraryItem[];
  memberIds: string[];
  locale: 'zh-CN' | 'en';
  tx: (zh: string, en: string) => string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<Photo>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const nextId = useRef(0);
  const request = useRef<{ controller: AbortController; photo?: Photo } | undefined>(undefined);

  const updateTurns = (next: Turn[]) => {
    turnsRef.current = next;
    setTurns(next);
  };

  useEffect(() => () => {
    request.current?.controller.abort();
    request.current = undefined;
  }, []);

  const stop = () => {
    const active = request.current;
    if (!active) return;
    request.current = undefined;
    active.controller.abort();
    if (active.photo) setPhoto(active.photo);
    setBusy(false);
  };

  const send = async (message: string) => {
    const attached = photo;
    const content = message.trim() || (attached ? tx('帮我看看这张图', 'Take a look at this photo') : '');
    if (!tripId || !content || request.current) return;
    const active = { controller: new AbortController(), photo: attached };
    request.current = active;
    nextId.current += 2;
    const turnId = nextId.current;
    const history: Turn[] = [...turnsRef.current, { id: turnId, role: 'user', text: content, imageUri: attached?.uri }];
    updateTurns(history);
    setDraft('');
    setPhoto(undefined);
    setBusy(true);
    setError(undefined);
    try {
      const reply = await sendTripChat({
        tripId,
        messages: history.map(messageFromTurn).filter(({ text }) => text),
        image: attached ? { base64: attached.base64, mimeType: attached.mimeType ?? 'image/jpeg' } : undefined,
        planIds: itineraryItems.map(({ id }) => id),
        memberIds,
        locale,
        signal: active.controller.signal,
      });
      if (request.current !== active) return;
      const proposals = proposalsFromReply(reply.actions, itineraryItems);
      const text = reply.answer || (proposals.length ? tx('这样改可以吗？', 'How about this?') : '');
      updateTurns([...turnsRef.current, { id: turnId + 1, role: 'assistant', text, proposals, run: reply.run }]);
    } catch (caught) {
      if (request.current !== active) return;
      setError(toUserMessage(caught, tx('小途暂时走神了，请稍后再试。', 'Tabi is unavailable right now. Try again later.'), locale));
      if (attached) setPhoto(attached);
    } finally {
      if (request.current === active) {
        request.current = undefined;
        setBusy(false);
      }
    }
  };

  const setStatus = (turnId: number, index: number, status: TripChatProposal['status']) => updateTurns(turnsRef.current.map((turn) => turn.id !== turnId ? turn : {
    ...turn,
    proposals: turn.proposals?.map((proposal, proposalIndex) => proposalIndex === index ? { ...proposal, status } : proposal),
  }));

  return { turns, draft, setDraft, photo, setPhoto, busy, error, setError, send, stop, setStatus };
}
