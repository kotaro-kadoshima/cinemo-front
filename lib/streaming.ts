interface StreamingService {
  service: {
    id: string;
    name: string;
    imageSet?: {
      lightThemeImage: string;
      darkThemeImage: string;
    };
  };
  streamingType: string;
  link: string;
}

interface StreamingData {
  id: number;
  imdbId: string;
  tmdbId: number;
  title: string;
  streamingOptions: {
    jp: StreamingService[];
  };
}

const RAPIDAPI_KEY = '357787d468msh70323279ec3f7e2p15daafjsn2474a508ab14';

export async function fetchStreamingInfo(tmdbId: number): Promise<StreamingService[]> {
  try {
    const response = await fetch(
      `https://streaming-availability.p.rapidapi.com/shows/movie/${tmdbId}?country=jp`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'streaming-availability.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      console.error('Streaming API error:', response.status);
      return [];
    }

    const data: StreamingData = await response.json();
    return data.streamingOptions?.jp || [];
  } catch (error) {
    console.error('Error fetching streaming info:', error);
    return [];
  }
}

export function getServiceDisplayName(serviceId: string): string {
  const serviceNames: Record<string, string> = {
    netflix: 'Netflix',
    prime: 'Amazon Prime Video',
    disney: 'Disney+',
    hulu: 'Hulu',
    paramount: 'Paramount+',
    apple: 'Apple TV+',
    hbo: 'HBO Max',
    crunchyroll: 'Crunchyroll',
    funimation: 'Funimation',
    tver: 'TVer',
    abema: 'ABEMA',
    utube: 'YouTube',
    wowow: 'WOWOW',
    dazn: 'DAZN',
  };
  
  return serviceNames[serviceId] || serviceId;
}

export function getServiceIcon(serviceId: string): string {
  const serviceIcons: Record<string, string> = {
    netflix: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEL0lEQVR4Ab3YA5DsWgKA4e+cJOOZvfbatm3btm17C2vbfrZt27aNcXdyXld18am7k7n3q2pGf1UcDT0Ub8f38Fdsr/v6O36Ad+GRGggG93C8Ga/R/8LPwi7YGidsrsAn4xt4hWb2x/dwyFIFFvgRPmNp/Qlfws1NAh+BHfEAm8dVeB2OrBP4Euxpy3grthok8EXY25b1RmwHABDd0f16xX1teeGfa4f8avWQ33Zef10zZH0WAMA7JwrfWjbkM1NDvtL5/HjncyQEd2NbPL5XYNbP3vWm8dy7OmGf7IR+bEXhfZ3YN0xkAODVY7lOlPdMFj40OeQdneAhPR2I8bsL/BU26uGY+aSar1zTqly1WLFQedV4BgCuLJML2pVLOq+LOq/LOq9KT5P4x10FPhQf04cb21zTZjTS/Z08dyzzoCLS3BvwDO4Y+Ht9qnBFiwiYS2R58I7JzBL5I0AE3BvP1qeJyHVtbinJAxHK5KVjSxb4MDwGIuAD9G80MlNxdXc1gxvayWNHogcWAQSNfRQi4O30LyDgkhYxkTCvu5rfOZmDMjWOfBNCxP1xX/pXYlnOVS2ubTMciGi1K6+fyMC1ZRI0sgxPjniaAaXEWHc1u3CR8QjcUPKwkehpnde5i0mFoJGnRjxUDSExGrmsRQWoIPDq8dytJa1E1Mh9IjYYUEKFVVl3FV/dYiQQMNtOXjoePaiIrmwnMWhiZcSUGipMZExXnLfQ/Z5wU8UjhoPHjgQXLRI1MhbVlBAwGblgkTIRENBK3G+YhUSJoL6IW9VUYWMRnNMpOW0+WZYRcGvF/Ya4R8bNJVFS01zElWpKiRU5l5fJPrOVkSyosJhYlbM255o2WVDXDRFnq6lCTicm2Gm61CqTYQRUuNcQrURS28URR6gpAR40xDGLpYNnKyvyAKbL7mpelnFrGQS1HB1xNi7TwPIIbDXdFrIgoaUbt7HgppLMwKZxRAT8X00JWQB2nim128loIKCVWJ+TkAxsB5QR8BcNRERcV3L4XGlZHiTMJdYXTEVmKoKB/B4i4Bwcp6YkGArA1reWhCChnZjMWFcwXRGDfl2EoyAC4EMaCWDb6dIti5WpQMBiYkORFIGU9OtDABEAJ+LfdbIiAK6rkt1mSxNFBPMVq/NgZcZM0o+9se8dA4EP4yY9rMuC++XRvfNgU+e1MgYBALvOlOTBuiJYW0TFcPTk0aDUU4m3A0AOAJjDc3GiuxCw31zpiPnSBe3KdOLasrKQEoAdpktvvGjOaAyWRR5QRDlGA3PJ3XkRru/n0cebsPVdBSa91Zj2Q/gzAECAXpFbwIfxJxgkEJ6GnbDa5jGLN2BPqBMIK/EzvMvS2h6fxaXQJBDgpfgGnqaZE/F97KgPweCehnfgVdioP1djd/wXB9hCIp6OT+Kn+Ce2xw74F36Oz+DZKNR0G9LyYOtXWmbtAAAAAElFTkSuQmCC',
    prime: 'data:image/png;base64,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',
    disney: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEWUlEQVR4AcSWU7hbQRRGy6C2bdu2bdu2bdu2bdu2bdtanf31NG1vzD78ORqszYk/XZjsriikUiGlrkoLlY4qPVT6rOmh9m6hNqaQzHFlL2cnZFbqr3RcCSd1XJub2RuAaZVGaJ7BTT3U1krrCUD/So2VTinhYZ3S1vbvKmBUzVK8rBGyl7OA8ZRmKeEjyV7xHAWM6js4M8io9gD9+yistsLt3xagJC3/WY2tAab1fLW6XN1pzQBdDm24fBiilMcQtz7GpK0wpOmAIXM3DLl7o8/RCX2a+uiiFHA61H4BMzvbhPVhC2GMUhtj9Droo5ZHF8EPRNic6OKXR59PQXZaga7tXHTJKjnTzDP/DdjfcbicGMKWwhChjILI47hX0tYg8LitBO4yA10kh+b1/w0Y0vGzNQf6MIWV9/K6ll9hcxCo0RACrj+KLmFJR87ukAJYyPFNxPKcbhdC4GIt8H/iikqB4vbGFhLAro4vnsNj1RqoYnuC7jqKLpxNg7sK4MK/XyZIXYFy1bpQo0FvCpVuTdgYBb3WUqKOnEvc7uNsjVkogEe1BzLkqsPufSdp22UMA4fPZunKHTx5+pL1m/ZTslKHfyaHi1mIvoNnMG32GmInLeMSoCFibuqeuYLRetEc9WevvRjD56RoubbsPXBa4EmU9lerWLh0q4J/Qftu41iwZIvLXsxSoyvx0lex2m4E8LMtuHmLN5meG7YYxIOHT8marwGnlOWHj51nyYrtpMtey61QF6/Q3tq3zzYBY6nQ3b7zkHgpyxNMC0OZKp14/OQFZat2RhaWHBWvynOiNBVNcwePnGvK6ZyFGpNYjYkUtyhRE5hX7umzV20Bmoc4TvKyLF+9kzt3H/Hly1fu3nvMh4+fmL94M0Ei5GLl2t1Ijq7duI81G/ayc89xps5aTe+B0xkych5dek9iy/bD1G7Uj6fPXqnUOIEAr1q3mxbtRyCpkTpLDSLHK4Y4QaJRqnJH5D5E5LxmIT7qF1A2iJ6oJOlz1kE8KO9iJC7FpSu3iRinCINGzGHuoo0I+IBhs5GwHzp6DoGQsF+7cY8Va3YxZ+FG3n/4yDpliHSEfQdPI8Cde01k49aD9Ow/lfWbD3BdjZ81fz1jJy1VkKXNimShX0CxbPKMVdRs2IdXr9/98y1Ntpo8evycSrW6I9+GjZ7P6vV7uHHzPidPX0EMkor/8eMHmxTEkeMXGD9lGZK/ABJOGRcmuunslihI1Ky0GSuNWlwtnvr27TvLVu1AikG8JPnXuNUQU55Ju2nXdSwS2rSqWKR/yrfsBRqRJW999h86Q68B0xCDnr94zYixC4md7N+2JO0quOVW09XmUSeQQ0fNQ0Kdr3gLUmetgUHr/M5KcnritBXOzivk5J8F1yV5JpX+cyR29PlRmlu0xC1d80HFDCl6Wgk1WOmPMRusmE3+QYL7Bn2naVB3O4dyx33ghz6G6uDRwA+/DYcBTPoPAY+EQfSBn4YAAMW09AcCluy+AAAAAElFTkSuQmCC',
    hulu: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAFRUlEQVR4Ac3YU5Qk2xYF0HlOJAtZ1Xb3tW3btm3btu/3s23btm1b3eVUxItx8y+b1Z5jhLUi9k6aPAkGsRn2wAm4HLfhHp3hNlyBE7EnNsMgCtahBHNxAG7CW/AD/BsNpMiQIUUD/8EP8DbcggMxD4lVFFZxnxq2wrk4ElugYnLq+A0+hbfiFxhCxuoHLGAhDscF2G8tlKmNb+BNOmH/iObqBCxjR1yCszDD2vVfvAOvxw9QtwzRslWwF+7HVesgHEzFVXgQ+6Oyqk+wjL1xP46yfnwWT+CrqK8oYAG74H6cYv36CB7F99EEiAAIWICLcIL17xhcgYUIAAEANZyFZzHVhrEY9+GtWAIRkGArXLwBw8EgLsa2SCACZuEc7GPD2wPnYw4EJNgXL8f2Ng6/wDX4ckQ/dsXmNh6bYnfUIqZgH1QAxCD0lSXTesV8ujpCEoVaRczPEapFk1TC3pgSMa27tKG/rHrU1mq3H6py2FZWRx5Mz0k7qN10sPJeC0miSdoeMyJmYwEAxN6y8v6b6b14b+W9FxJMWhysqhy+ld4L9lDcYa6QBJM0D3M6AenTLSAJ9JYk8wbzYUDsrxADCPl8Mn+gU8JiQhLFqT35ukF5aQmACOT7iDP6xPw88nmIA1XJggF5K1GIuvRhVkQNRd2yjCQo7zrfwN2H58MR+q7ZT2m3eUKloJSXrXbroaqn7SxO7xVrZdXjt+u0Rf70JZEM0E7Fmf36ztpV7eaDJXNqoHzg5gZuO1zllB3lYXVJ0B9RQtAtIxSiZLNpqkduo+fY7fRfe4De03eRzKopbTldTx6ucsBmYq0i9JSU91qk58xd8pLO7pQ0A2SZPIDywZvrPWUncVoPKO00RzUPXdlvU6GvZBlK0fIEslam9cO/Gnr+s0be9E2SqLDt7Dxgn6yNLNMZAGnWGTLLliFNO/ugs29KZrkiGsh0E2i1NX78N8Ov/4bR9/9INjwhlAokCSAIMVAIFDp9KAQrFINQLMiro9MGwfJpFDCMFooAICBDmtFOaXXunIyAVlvWbits3il1Vm8rbjOLNJU1W7J2RgBAoyXLh1Atq568o9LOc5Xy/o6VRDrRop3p0sZwAX/HMKYCgBBIABAQIyGA1u//q/XzfyjuMk/fJXvJUmJPSfPX/9L67X9pp0Q65wna/xnV+MnflfZYqP/83aSNttBXli4e1/zBn2XDdV1G8I9OQP6CqQDZWEP9m38UYtD4zp9BfiJj7/+h9H9j0n+OaP931PCrvqa89yKxViVm0rGWxnf/rPGtPyCY+PLvpP8e1fzFv/L9x4x/8Mey0YbiFjNIoqydav3mXyY+/Qvp8IQuf5MPAZvhCZwLIAlCrSr2lmSj9TzUOC+9j/XSymRLxmX1VmddrSxUS3TKKB2akE20hGIi1CpCtSBdUpf3LyGIPUVhsEoIpJl2fuPGG2S6vQf3BAziEjyDso1DAw/i1RHD+C5+a+PxB3wLQxFt/AafQNuG18an8Su0IuDveBu+YcP7Lt6Mv0MAwADOwdOYYsMYwgN4ExZD7Nr4abwD7Q1U2nfhYxgCCACAInbBwzje+vUJPIpvL++HOzTxQ7yIz1p/voAX8T00YXkBoY6v4Ul8ZB2XO8XH8SS+jInJ/v22Cy7FWZhi7VqCd+PV+P6ywkG0fHV8Fy/gfnx9LT3NNr6FB/EcvoMJmGxAaOK3eCtuxcvxczRMXgO/xCtxM96EX6NpLUkwD4fgDrwTP8FiNJF1DU0sxk/xbtyJQ7EAiXWogCnYAnvjVFyNO3G/znAnrsWp2BdbYCoKJun/TfuiNKEMC/cAAAAASUVORK5CYII=",
  };
  
  return serviceIcons[serviceId] || '🎦';
}