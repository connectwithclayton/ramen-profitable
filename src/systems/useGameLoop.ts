import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useGame } from '../state/gameStore';

export function useGameLoop() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const g = useGame.getState();

    // Welcome-back money
    const earned = g.applyOfflineEarnings();
    if (earned > 1) {
      g.pushNotif(`While you were gone, your apps earned $${Math.floor(earned)}. The dream, working.`, 'night');
    }

    const fast = setInterval(() => useGame.getState().fastTick(), 500);
    const slow = setInterval(() => useGame.getState().slowTick(), 5000);
    const events = setInterval(() => useGame.getState().maybeEvent(), 22000);

    const sub = AppState.addEventListener('change', state => {
      const s = useGame.getState();
      if (state === 'active') {
        const e = s.applyOfflineEarnings();
        if (e > 1) s.pushNotif(`Welcome back. Offline earnings: $${Math.floor(e)}.`, 'night');
      } else {
        s.touchLastSeen();
      }
    });

    return () => {
      clearInterval(fast);
      clearInterval(slow);
      clearInterval(events);
      sub.remove();
    };
  }, []);
}
