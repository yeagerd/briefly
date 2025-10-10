'use client';

import { Draft, DraftAction, DraftMetadata, DraftState, DraftType } from '@/types/draft';
import { createContext, ReactNode, useCallback, useContext, useReducer } from 'react';

const initialState: DraftState = {
    currentDraft: null,
    draftList: [],
    isLoading: false,
    error: null,
    autoSaveEnabled: true,
    lastAutoSave: null,
};

function draftReducer(state: DraftState, action: DraftAction): DraftState {
    switch (action.type) {
        case 'SET_CURRENT_DRAFT':
            return {
                ...state,
                currentDraft: action.payload as Draft | null,
                error: null,
            };

        case 'UPDATE_DRAFT':
            if (!state.currentDraft) return state;
            return {
                ...state,
                currentDraft: {
                    ...state.currentDraft,
                    ...(action.payload as Partial<Draft>),
                    updatedAt: new Date().toISOString(),
                },
            };

        case 'CLEAR_DRAFT':
            return {
                ...state,
                currentDraft: null,
                error: null,
            };

        case 'SET_LOADING':
            return {
                ...state,
                isLoading: action.payload as boolean,
            };

        case 'SET_ERROR':
            return {
                ...state,
                error: action.payload as string | null,
                isLoading: false,
            };

        case 'SET_DRAFT_LIST':
            return {
                ...state,
                draftList: action.payload as Draft[],
                isLoading: false,
            };

        case 'ADD_DRAFT':
            return {
                ...state,
                draftList: [...state.draftList, action.payload as Draft],
            };

        case 'REMOVE_DRAFT':
            return {
                ...state,
                draftList: state.draftList.filter(draft => draft.id !== (action.payload as string)),
            };

        default:
            return state;
    }
}

interface DraftContextType {
    state: DraftState;
    setCurrentDraft: (draft: Draft | null) => void;
    updateDraft: (updates: Partial<Draft>) => void;
    updateDraftContent: (content: string) => void;
    updateDraftMetadata: (metadata: Partial<DraftMetadata>) => void;
    clearDraft: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setDraftList: (drafts: Draft[]) => void;
    addDraft: (draft: Draft) => void;
    removeDraft: (draftId: string) => void;
    createNewDraft: (type: DraftType, userId: string) => Draft;
}

export const DraftContext = createContext<DraftContextType | undefined>(undefined);

export function DraftProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(draftReducer, initialState);

    const setCurrentDraft = useCallback((draft: Draft | null) => {
        dispatch({ type: 'SET_CURRENT_DRAFT', payload: draft });
    }, []);

    const updateDraft = useCallback((updates: Partial<Draft>) => {
        dispatch({ type: 'UPDATE_DRAFT', payload: updates });
    }, []);

    const updateDraftContent = useCallback((content: string) => {
        dispatch({ type: 'UPDATE_DRAFT', payload: { content } });
    }, []);

    const updateDraftMetadata = useCallback((metadata: Partial<DraftMetadata>) => {
        if (!state.currentDraft) return;
        dispatch({ type: 'UPDATE_DRAFT', payload: { metadata: { ...state.currentDraft.metadata, ...metadata } } });
    }, [state.currentDraft]);

    const clearDraft = useCallback(() => {
        dispatch({ type: 'CLEAR_DRAFT' });
    }, []);

    const setLoading = useCallback((loading: boolean) => {
        dispatch({ type: 'SET_LOADING', payload: loading });
    }, []);

    const setError = useCallback((error: string | null) => {
        dispatch({ type: 'SET_ERROR', payload: error });
    }, []);

    const setDraftList = useCallback((drafts: Draft[]) => {
        dispatch({ type: 'SET_DRAFT_LIST', payload: drafts });
    }, []);

    const addDraft = useCallback((draft: Draft) => {
        dispatch({ type: 'ADD_DRAFT', payload: draft });
    }, []);

    const removeDraft = useCallback((draftId: string) => {
        dispatch({ type: 'REMOVE_DRAFT', payload: draftId });
    }, []);

    const createNewDraft = useCallback((type: DraftType, userId: string) => {
        const newDraft: Draft = {
            id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            status: 'draft',
            content: '',
            metadata: {},
            isAIGenerated: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId,
        };

        dispatch({ type: 'SET_CURRENT_DRAFT', payload: newDraft });
        dispatch({ type: 'ADD_DRAFT', payload: newDraft });

        return newDraft;
    }, []);

    const value: DraftContextType = {
        state,
        setCurrentDraft,
        updateDraft,
        updateDraftContent,
        updateDraftMetadata,
        clearDraft,
        setLoading,
        setError,
        setDraftList,
        addDraft,
        removeDraft,
        createNewDraft,
    };

    return (
        <DraftContext.Provider value={value}>
            {children}
        </DraftContext.Provider>
    );
}

export function useDraftContext(): DraftContextType {
    const context = useContext(DraftContext);
    if (context === undefined) {
        throw new Error('useDraftContext must be used within a DraftProvider');
    }
    return context;
}
