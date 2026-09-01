import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as briefApi from '../../api/briefApi';
import type { BriefObject, FlowState, ObjectRelationship, ProtocolAction } from '../../model/core';
import { createPursuit, getPivotMessage } from '../../model/core';

// ---------------------------------------------------------------------------
// useProtocolActions -- extracted from App.tsx (Phase 4). Owns this slice of shell state
// + handlers; route-sync/popstate effects STAY in App (they read the returned
// setters). Interface notes are inline; verify with run-suites.sh.
// ---------------------------------------------------------------------------

export interface UseProtocolActionsParams {
  noteActivation: any;
  objects: any;
  pursuits: any;
  setActiveTab: any;
  setNearbySection: any;
  setPersonalState: any;
  setPursuits: any;
  setRelationships: any;
  setSearchQuery: any;
  setSelectedObjectForDetail: any;
  setSelectedObjectType: any;
  showToast: any;
}

export function useProtocolActions(params: UseProtocolActionsParams) {
  const {
    noteActivation,
    objects,
    pursuits,
    setActiveTab,
    setNearbySection,
    setPersonalState,
    setPursuits,
    setRelationships,
    setSearchQuery,
    setSelectedObjectForDetail,
    setSelectedObjectType,
    showToast,
  } = params;

  const handlePivotToType = (object: BriefObject) => {
    const others = objects.filter(
      (item: any) => item.type === object.type && item.id !== object.id
    ).length;

    setSelectedObjectType(object.type);
    setSearchQuery('');
    setActiveTab('nearby');
    setNearbySection('stream');
    setSelectedObjectForDetail(null);
    handleExecuteProtocolAction('discover', object, { silent: true });
    showToast(getPivotMessage(object, others));
  };

  const handleExecuteProtocolAction = (
    action: ProtocolAction,
    object: BriefObject,
    options?: { silent?: boolean }
  ) => {
    let nextState: FlowState = 'engaged';
    let verb = 'interacted_with';

    if (action === 'book' || action === 'contact' || action === 'buy') {
      nextState = 'committed';
      verb = action === 'book' ? 'booked' : action === 'buy' ? 'bought' : 'contacted';
    } else if (action === 'save') {
      nextState = 'engaged';
      verb = 'saved';
    }

    // The aha moment, reported once it has actually happened. "saved" is the
    // activation event Brief measures itself on; opening is the step before it.
    if (action === 'save') {
      noteActivation('object_saved', { objectId: object.id, type: object.type });
      // Durable copy: the same save, persisted server-side, so it survives
      // across devices. Best-effort — the local graph stays the live source.
      void briefApi.saveObjectForMe(object.id).then((r) => {
        if (r.ok) setPersonalState((p: any) => (p ? { ...p, saved: r.data.saved } : p));
      });
    }
    else if (action === 'discover' || action === 'read') noteActivation('object_opened', { objectId: object.id });

    setRelationships((prev: any[]) => {
      const existingIdx = prev.findIndex((r: any) => r.targetId === object.id);
      const newEdge: ObjectRelationship = {
        id: `rel_${Date.now()}`,
        sourceType: 'identity',
        sourceId: 'usr_me',
        verb,
        targetType: object.type,
        targetId: object.id,
        state: nextState,
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newEdge;
        return updated;
      }
      return [...prev, newEdge];
    });

    const actionLabels: Record<ProtocolAction, string> = {
      discover: 'Opened',
      read: 'Opened',
      save: 'Saved',
      share: 'Shared',
      contact: 'Contact started',
      book: 'Booking',
      buy: 'Purchase',
      report: 'Reported',
      verify: 'Verification started',
      follow: 'Following',
    };

    // Callers that show their own message suppress this one.
    if (!options?.silent) {
      showToast(`${actionLabels[action]} "${object.title}".`);
    }
  };

  const handleCreatePursuit = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (query === '') return;

    const existing = pursuits.find(
      (p: any) => p.query.toLowerCase() === query.toLowerCase()
    );
    if (existing) {
      setActiveTab('nearby');
      setNearbySection('pursuits');
      showToast('Already pursuing this');
      return;
    }

    const pursuit = createPursuit(query, new Date().toISOString());
    setPursuits((prev: any) => [pursuit, ...prev]);
    // Handing a query to Brief means you are done typing it. Leaving it in the
    // search box would strand the stream on an empty result set.
    setSearchQuery('');
    setActiveTab('nearby');
    setNearbySection('pursuits');
    showToast(
      pursuit.watchChanges
        ? `Watching: ${pursuit.query}`
        : `Pursuing: ${pursuit.query}`
    );
  };

  return {
    handleCreatePursuit,
    handleExecuteProtocolAction,
    handlePivotToType,
  };
}
