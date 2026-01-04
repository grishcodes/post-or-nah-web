declare module 'heic-convert' {
  export function convert(options: {
    blob: Blob;
    toType: string;
    quality?: number;
  }): Promise<Blob>;
}
