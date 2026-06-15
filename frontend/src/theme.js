import { createTheme } from '@mui/material/styles';

// Dark theme matching existing CSS variables
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#4dabf7' },   // --accent blue
    secondary:  { main: '#69db7c' },   // green
    error:      { main: '#ff6b6b' },
    warning:    { main: '#ffa94d' },
    success:    { main: '#69db7c' },
    background: {
      default: '#0d1117',  // --bg
      paper:   '#161b22',  // --surface
    },
    text: {
      primary:   '#e6edf3',
      secondary: '#8b949e',
    },
    divider: '#30363d',
  },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    fontSize: 13,
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: '#30363d' },
        head: { color: '#8b949e', fontWeight: 600, fontSize: 12 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { fontSize: 13 },
        notchedOutline: { borderColor: '#30363d' },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: 13 } },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } },
    },
    MuiChip: {
      styleOverrides: { root: { fontSize: 12 } },
    },
  },
});

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#1971c2' },
    secondary:  { main: '#2f9e44' },
    error:      { main: '#c92a2a' },
    warning:    { main: '#e67e22' },
    success:    { main: '#2f9e44' },
    background: {
      default: '#f6f8fa',
      paper:   '#ffffff',
    },
    text: {
      primary:   '#1c2128',
      secondary: '#57606a',
    },
    divider: '#d0d7de',
  },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    fontSize: 13,
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, fontSize: 12 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { fontSize: 13 } },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: 13 } },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } },
    },
  },
});
