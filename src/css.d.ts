declare module '*.css';
declare module '*.html?raw' {
  const value: string;
  export default value;
}
