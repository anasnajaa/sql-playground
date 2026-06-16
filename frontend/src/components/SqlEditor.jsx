import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { sql, MSSQL } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';

const themeCompartment = new Compartment();

const lightTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)', color: 'var(--text)' },
  '.cm-content':        { caretColor: 'var(--text)', padding: '12px 0' },
  '.cm-line':           { padding: '0 16px' },
  '.cm-cursor':         { borderLeftColor: 'var(--text)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: '#bfcbff !important' },
  '.cm-gutters': {
    backgroundColor: 'var(--surface2)',
    color: 'var(--text-muted)',
    border: 'none',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface)' },
  '.cm-activeLine':       { backgroundColor: 'rgba(92,124,250,0.07)' },
  '.cm-foldPlaceholder':  { backgroundColor: 'var(--surface2)', color: 'var(--text-muted)' },
  '.cm-tooltip':          { backgroundColor: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' },
}, { dark: false });

const darkThemeOverride = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)' },
  '.cm-content':  { padding: '12px 0' },
  '.cm-line':     { padding: '0 16px' },
  '.cm-gutters':  { backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' },
  '.cm-activeLine': { backgroundColor: 'rgba(92,124,250,0.09)' },
}, { dark: true });

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7', overflow: 'auto' },
  '.cm-content': { fontWeight: 'bold' },
});

function themeExtension(isDark) {
  return isDark ? [oneDark, darkThemeOverride] : lightTheme;
}

export default function SqlEditor({ value, onChange, theme }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Create editor once
  useEffect(() => {
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          sql({ dialect: MSSQL }),
          themeCompartment.of(themeExtension(theme === 'dark')),
          baseTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.lineWrapping,
        ],
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => view.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync value when changed externally (sample query clicks)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  // Swap theme without rebuilding the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: themeCompartment.reconfigure(themeExtension(theme === 'dark')) });
  }, [theme]);

  return <div ref={containerRef} className="editor-wrap" />;
}
