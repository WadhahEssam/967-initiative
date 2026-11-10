'use client';
import {useEffect} from 'react';
import {trackFunnel} from '@/components/analytics/funnel';

// Counts a visit that came from a shared result (share_arrival), once per tab session.
export default function ShareArrival({kind}) {
  useEffect(() => { trackFunnel('share_arrival', kind); }, [kind]);
  return null;
}
