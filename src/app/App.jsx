import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles.css';

const randomRoomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function useRoomChannel(roomCode, player) {
  const channelRef = useRef(null);
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [targetNumber, setTargetNumber] = useState(() => Math.floor(Math.random() * 100) + 1);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    if (!roomCode || !player) return;
    const channel = new BroadcastChannel(`room-${roomCode}`);
    channelRef.current = channel;
    channel.postMessage({ type: 'join', player });

    const onMessage = (event) => {
      const data = event.data;
      if (!data?.type) return;
      if (data.type === 'join') setPlayers((prev) => (prev.some((p) => p.id === data.player.id) ? prev : [...prev, data.player]));
      if (data.type === 'leave') setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
      if (data.type === 'chat') setMessages((prev) => [...prev, data.message]);
      if (data.type === 'start-game') {
        setWinner(null);
        setTargetNumber(data.targetNumber);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), system: true, text: 'Nouvelle partie lancée !' }]);
      }
      if (data.type === 'guess') {
        const feedback = data.value === targetNumber ? `🎉 ${data.playerName} a trouvé ${targetNumber} !` : data.value < targetNumber ? `${data.playerName} propose ${data.value} (trop petit)` : `${data.playerName} propose ${data.value} (trop grand)`;
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), system: true, text: feedback }]);
        if (data.value === targetNumber) setWinner(data.playerName);
      }
    };

    channel.addEventListener('message', onMessage);
    return () => {
      channel.postMessage({ type: 'leave', playerId: player.id });
      channel.removeEventListener('message', onMessage);
      channel.close();
    };
  }, [player, roomCode, targetNumber]);

  return {
    players,
    messages,
    winner,
    sendMessage: (text) => {
      const message = { id: crypto.randomUUID(), playerName: player.name, text, createdAt: new Date().toISOString() };
      channelRef.current?.postMessage({ type: 'chat', message });
      setMessages((prev) => [...prev, message]);
    },
    startGame: () => {
      const newTarget = Math.floor(Math.random() * 100) + 1;
      setTargetNumber(newTarget);
      setWinner(null);
      channelRef.current?.postMessage({ type: 'start-game', targetNumber: newTarget });
    },
    sendGuess: (value) => channelRef.current?.postMessage({ type: 'guess', value, playerName: player.name }),
  };
}

export default function App() {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [chatText, setChatText] = useState('');
  const [guess, setGuess] = useState('');
  const player = useMemo(() => (joined ? { id: crypto.randomUUID(), name } : null), [joined, name]);
  const { players, messages, winner, sendMessage, startGame, sendGuess } = useRoomChannel(roomCode, player);

  if (!joined) return <main className="container"><h1>Room Battle 🎮</h1><p>Jeu multijoueur local (multi-onglets).</p><div className="card"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton pseudo" /><div className="actions"><button disabled={!name.trim()} onClick={() => { setRoomCode(randomRoomCode()); setJoined(true); }}>Créer une room</button><input value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder="Code room" /><button disabled={!name.trim()} onClick={() => { if (roomInput.trim()) { setRoomCode(roomInput.trim().toUpperCase()); setJoined(true); } }}>Rejoindre</button></div></div></main>;

  return <main className="container"><h1>Room: {roomCode}</h1><p>Partage ce code pour inviter d'autres joueurs.</p><section className="grid"><div className="card"><h2>Joueurs</h2><ul>{[...players, player].filter((p, i, arr) => p && arr.findIndex((x) => x.id === p.id) === i).map((p) => <li key={p.id}>{p.name}</li>)}</ul><button onClick={startGame}>Nouvelle partie</button>{winner && <p className="winner">Gagnant: {winner}</p>}<div className="guess"><input type="number" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Ton nombre" /><button onClick={() => guess && sendGuess(Number(guess))}>Valider</button></div></div><div className="card"><h2>Chat</h2><div className="chat">{messages.map((m) => <p key={m.id}><strong>{m.system ? 'Système' : m.playerName}:</strong> {m.text}</p>)}</div><div className="actions"><input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Message" /><button onClick={() => { if (chatText.trim()) { sendMessage(chatText.trim()); setChatText(''); } }}>Envoyer</button></div></div></section></main>;
}
