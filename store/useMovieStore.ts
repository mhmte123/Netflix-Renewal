import { getTmdbLang } from "@/lib/i18n";
import { getNetflixOriginals } from "@/lib/netflix";
import { create } from "zustand";
import type { CastMember, DirectorMember, HighlightItem, MovieState, RecommendedItem } from "@/types/movie";
import { filterHidden, isHidden } from "@/data/hiddenContent";

//TMBD키
const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY

type HighlightMovie = Pick<HighlightItem, "id" | "title" | "poster_path" | "backdrop_path">;

export const useMovieStore = create<MovieState>((set, get) => ({
    //인기영화를 저장할 변수
    popMovies: [],
    //영화를 불러올 메서드
    onFetchPopular: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=${getTmdbLang()}&page=1`);
        const data = await res.json();
        // console.log("인기영화?", data.results);
        set({ popMovies: filterHidden(data.results ?? []) });
    },

    //==============최신 영화 받아오기==============
    //최신영화를 저장할 변수
    newMovies: [],
    //최신 영화 불러오기
    onFetchNewest: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=${getTmdbLang()}&page=1`);
        const data = await res.json();
        // console.log("최신영화?", data.results);
        set({ newMovies: filterHidden(data.results ?? []) });
    },

    //==============급상승 영화 받아오기==============
    //급상승 영화를 저장할 변수
    trendingMovies: [],
    //최신 영화 불러오기 (day기준)
    onFetchTrending: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_KEY}&language=${getTmdbLang()}&page=1`);
        const data = await res.json();
        // console.log("급상승 영화?", data.results);
        set({ trendingMovies: filterHidden(data.results ?? []) });
    },

    //==============한국 영화 (2026년 이후)==============
    koreanMovies: [],
    onFetchKoreanMovies: async () => {
        // 차단 작품/제외 장르/관람등급 필터 후에도 TOP 10이 채워지도록 2페이지까지 가져온다.
        const base = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=${getTmdbLang()}&with_original_language=ko&primary_release_date.gte=2026-01-01&sort_by=popularity.desc`;
        const [d1, d2] = await Promise.all([
            fetch(`${base}&page=1`).then((r) => r.json()),
            fetch(`${base}&page=2`).then((r) => r.json()),
        ]);
        const seen = new Set<number>();
        const merged = [...(d1.results || []), ...(d2.results || [])].filter((m: { id: number }) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });
        set({ koreanMovies: filterHidden(merged) });
    },

    //==============급상승 영화 받아오기==============

    //티비
    //영화의 영상을 저장할 변수 popVideos
    popVideos: {},
    //영화의 영상을 불러올 메서드 onFetchVideo id
    onFetchVideo: async (id) => {
        const movieId = Number(id);
        const { popVideos } = get();

        // console.log(movieId)
        if (popVideos[movieId]) return;

        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${TMDB_KEY}&language=${getTmdbLang()}`);
        const data = await res.json();
        // console.log("비디오?", id, data.results);
        set((state) => ({
            popVideos: {
                ...state.popVideos,
                [id]: data.results
            }
        }))
    },
    tvs: [],
    tvVideos: {},
    onFetchTvs: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=${getTmdbLang()}&page=1`);
        const data = await res.json();
        // console.log("인기영화?", data.results);
        set({ tvs: filterHidden(data.results ?? []) });
    },
    onFetchTvVideos: async (id) => {
        const tvId = Number(id);
        const { tvVideos } = get();

        // console.log("티비아이디", tvId);
        if (tvVideos[tvId]) return;

        const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}/videos?api_key=${TMDB_KEY}&language=en-US`);
        const data = await res.json();
        // console.log("비디오?", id, data.results);
        set((state) => ({
            tvVideos: {
                ...state.tvVideos,
                [tvId]: data.results
            }
        }))
    },
    seasons: [],
    onFetchSeasons: async (id) => {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}&language=${getTmdbLang()}`);
        const data = await res.json();
        // console.log("시즌?", data.results);
        set({ seasons: data.seasons });
    },
    episodes: [],
    onFetchEpisodes: async (id, season) => {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_KEY}&language=${getTmdbLang()}`);
        const data = await res.json();
        // console.log("에피소드", data.results);
        set({ episodes: data.episodes });
    },
    upcomings: [],
    onFetchUpcoming: async () => {
        const today = new Date().toISOString().split('T')[0];
        const [krMovieRes, krTvRes, globalMovieRes, globalTvRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_KEY}&language=${getTmdbLang()}&region=KR&page=1`),
            fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=${getTmdbLang()}&with_original_language=ko&first_air_date.gte=${today}&sort_by=popularity.desc&page=1`),
            fetch(`https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_KEY}&language=${getTmdbLang()}&page=1`),
            fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=${getTmdbLang()}&first_air_date.gte=${today}&sort_by=popularity.desc&page=1`),
        ]);
        const [krMovieData, krTvData, globalMovieData, globalTvData] = await Promise.all([
            krMovieRes.json(), krTvRes.json(), globalMovieRes.json(), globalTvRes.json(),
        ]);

        const normalize = (items: any[], isTV = false) =>
            (items || [])
                .filter((i: any) => i.backdrop_path)
                .map((i: any) => isTV ? { ...i, title: i.name, release_date: i.first_air_date } : i);

        const krMovies = normalize(krMovieData.results);
        const krTvs   = normalize(krTvData.results, true);
        const globalMovies = normalize(globalMovieData.results);
        const globalTvs    = normalize(globalTvData.results, true);

        // 한국 콘텐츠 먼저, 중복 제거 후 해외 콘텐츠 추가
        const korean = [...krMovies, ...krTvs].sort(() => Math.random() - 0.5);
        const krIds  = new Set(korean.map((i: any) => i.id));
        const global = [...globalMovies, ...globalTvs]
            .filter((i: any) => !krIds.has(i.id))
            .sort(() => Math.random() - 0.5);

        set({ upcomings: filterHidden([...korean, ...global]) });
    },
    //넷플릭스 오리지널: TMDB discover/tv, with_networks=213
    netflixOriginals: [],
    netflixOriginalsLoading: false,
    netflixOriginalsPage: 1,
    netflixOriginalsTotalPages: 1,
    onFetchNetflixOriginals: async (page = 1) => {
        set({ netflixOriginalsLoading: true });
        try {
            const data = await getNetflixOriginals(page);
            const normalize = (items: typeof data.results) =>
                items.map((item) => ({
                    ...item,
                    poster_path: item.poster_path ?? "",
                    backdrop_path: item.backdrop_path ?? "",
                }));
            set((state) => ({
                netflixOriginals: page === 1
                    ? filterHidden(normalize(data.results))
                    : [...state.netflixOriginals, ...filterHidden(normalize(data.results))],
                netflixOriginalsPage: data.page,
                netflixOriginalsTotalPages: data.total_pages,
            }));
        } catch (error) {
            console.error("넷플릭스 오리지널 조회 실패:", error);
        } finally {
            set({ netflixOriginalsLoading: false });
        }
    },
    //스틸컷(백드롭) 가져오기
    movieImages: {},
    onFetchMovieImages: async (id) => {
        const movieId = Number(id);
        const { movieImages } = get();
        if (movieImages[movieId]) return;
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${TMDB_KEY}&include_image_language=null,en,ko`);
        const data = await res.json();
        set((state) => ({
            movieImages: {
                ...state.movieImages,
                [movieId]: data.backdrops || []
            }
        }));
    },
    tvImages: {},
    onFetchTvImages: async (id) => {
        const tvId = Number(id);
        const { tvImages } = get();
        if (tvImages[tvId]) return;
        //include_image_language=null,en,ko 로 다양한 이미지 확보
        const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}/images?api_key=${TMDB_KEY}&include_image_language=null,en,ko`);
        const data = await res.json();
        // console.log("스틸컷", tvId, data.backdrops);
        set((state) => ({
            tvImages: {
                ...state.tvImages,
                [tvId]: data.backdrops || []
            }
        }))
    },
    //추천작: 인기 영화 + 인기 TV 를 합쳐서 셔플
    recommended: [],
    mediaRecommended: {},
    mediaDetails: {},
    onFetchMediaDetail: async (id, mediaType) => {
        const mediaId = Number(id);
        const key = `${mediaType}-${mediaId}`;
        const { mediaDetails } = get();
        if (mediaDetails[key]) return;

        const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${TMDB_KEY}&language=${getTmdbLang()}`);
        const data = await res.json();

        set((state) => ({
            mediaDetails: {
                ...state.mediaDetails,
                [key]: data
            }
        }));
    },
    onFetchRecommended: async () => {
        // 넷플릭스(213) 한국 시리즈 위주로, 랜덤 페이지(1~3)
        const tvPage1 = Math.floor(Math.random() * 3) + 1;
        const tvPage2 = (tvPage1 % 3) + 1;

        const [tvRes1, tvRes2, movieRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=${getTmdbLang()}&with_networks=213&with_original_language=ko&sort_by=popularity.desc&page=${tvPage1}`),
            fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=${getTmdbLang()}&with_networks=213&with_original_language=ko&sort_by=popularity.desc&page=${tvPage2}`),
            fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=${getTmdbLang()}&with_original_language=ko&sort_by=popularity.desc&page=1`),
        ]);
        const [tvData1, tvData2, movieData] = await Promise.all([
            tvRes1.json(), tvRes2.json(), movieRes.json()
        ]);

        const tvs = [...(tvData1.results || []), ...(tvData2.results || [])]
            .filter((t: any) => t.backdrop_path)
            .map((t: any) => ({
                ...t,
                media_type: "tv" as const,
                title: t.name,
                release_date: t.first_air_date
            }));

        const movies = (movieData.results || [])
            .filter((m: any) => m.backdrop_path)
            .map((m: any) => ({
                ...m,
                media_type: "movie" as const,
                title: m.title,
                release_date: m.release_date
            }));

        // 한국 시리즈 위주: TV 9개 + 영화 3개 섞기
        const shuffledTvs = tvs.sort(() => Math.random() - 0.5).slice(0, 9);
        const shuffledMovies = movies.sort(() => Math.random() - 0.5).slice(0, 3);
        const merged = [...shuffledTvs, ...shuffledMovies].sort(() => Math.random() - 0.5);
        // console.log("추천작(한국 시리즈)", merged);
        set({ recommended: filterHidden(merged) });
    },
    onFetchMediaRecommended: async (id, mediaType) => {
        const key = `${mediaType}-${id}`;
        const { mediaRecommended } = get();
        if (mediaRecommended[key]) return;

        const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${id}/recommendations?api_key=${TMDB_KEY}&language=${getTmdbLang()}&page=1`);
        const data = await res.json();
        const items = (filterHidden(
            (data.results || []).map((item: any) => ({
                ...item,
                media_type: item.media_type ?? mediaType,
                title: item.title ?? item.name,
                release_date: item.release_date ?? item.first_air_date,
            }))
        ) as RecommendedItem[]).slice(0, 6);

        set((state) => ({
            mediaRecommended: { ...state.mediaRecommended, [key]: items }
        }));
    },
    //작품 출연진/감독 캐시
    casts: {},
    personDetails: {},
    personCredits: {},
    personExternalIds: {},
    onFetchPersonDetail: async (id) => {
        const { personDetails } = get();
        if (personDetails[id]) return;
        const res = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_KEY}&language=${getTmdbLang()}`);
        const data = await res.json();
        set((state) => ({
            personDetails: { ...state.personDetails, [id]: data }
        }));
    },
    onFetchPersonCredits: async (id) => {
        const { personCredits } = get();
        if (personCredits[id]) return;
        const res = await fetch(`https://api.themoviedb.org/3/person/${id}/combined_credits?api_key=${TMDB_KEY}&language=${getTmdbLang()}`);
        const data = await res.json();
        const cast: import("@/types/movie").PersonCredit[] = (data.cast || []).map((item: any) => ({
            id: item.id,
            title: item.title || item.name || "",
            poster_path: item.poster_path ?? null,
            backdrop_path: item.backdrop_path ?? null,
            media_type: item.media_type,
            character: item.character || "",
            release_date: item.release_date || item.first_air_date || undefined,
            vote_average: item.vote_average ?? 0,
        }));
        cast.sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""));
        set((state) => ({
            personCredits: { ...state.personCredits, [id]: cast }
        }));
    },
    onFetchPersonExternalIds: async (id) => {
        const { personExternalIds } = get();
        if (personExternalIds[id]) return;
        const [extRes, detailRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/person/${id}/external_ids?api_key=${TMDB_KEY}`),
            fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_KEY}&language=en-US`),
        ]);
        const ext = await extRes.json();
        const detail = await detailRes.json();
        set((state) => ({
            personExternalIds: {
                ...state.personExternalIds,
                [id]: {
                    imdb_id: ext.imdb_id ?? null,
                    facebook_id: ext.facebook_id ?? null,
                    instagram_id: ext.instagram_id ?? null,
                    twitter_id: ext.twitter_id ?? null,
                    tiktok_id: ext.tiktok_id ?? null,
                    youtube_id: ext.youtube_id ?? null,
                    homepage: detail.homepage ?? null,
                }
            }
        }));
    },
    directors: {},
    onFetchCredits: async (id, mediaType) => {
        const key = `${mediaType}-${id}`;
        const { casts } = get();
        if (casts[key]) return;
        
        const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${id}/credits?api_key=${TMDB_KEY}&language=${getTmdbLang()}`);
        const data = await res.json();
        
        // --- Cast 중복 제거 로직 ---
        // CastMember[] 타입이라고 가정합니다.
        const uniqueCasts: CastMember[] = Array.from(
            new Map<number, CastMember>(
                (data.cast || []).map((m: any) => [m.id, m as CastMember])
            ).values()
        );

        // --- Director 중복 제거 로직 ---
        const directorJobs = ["Director", "Novel", "Screenplay", "Story", "Writer", "Creator"];
        const uniqueDirectors: DirectorMember[] = Array.from(
            new Map<number, DirectorMember>(
                (data.crew || [])
                    .filter((m: any) => directorJobs.includes(m.job))
                    .map((m: any) => [m.id, m as DirectorMember])
            ).values()
        );

        set((state) => ({
            casts: { ...state.casts, [key]: uniqueCasts },
            directors: { ...state.directors, [key]: uniqueDirectors },
        }));
    },
    //전 세계 인기 인물 (배우/감독)
    popularPeople: [],
    netflixHighlights: [],
    onFetchPopularPeople: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/person/popular?api_key=${TMDB_KEY}&language=${getTmdbLang()}&page=1`);
        const data = await res.json();
        // console.log("인기 인물", data.results);
        set({ popularPeople: data.results || [] });
    },
    onFetchNetflixHighlights: async () => {
        const { netflixHighlights } = get();
        if (netflixHighlights.length > 0) return;

        const popularRes = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=${getTmdbLang()}&page=1`);
        const popularData = await popularRes.json();
        const movies = (filterHidden(popularData.results || []) as HighlightMovie[]).slice(0, 12);

        const highlightResults = await Promise.all(
            movies.map(async (movie) => {
                const [koRes, enRes] = await Promise.all([
                    fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${TMDB_KEY}&language=${getTmdbLang()}`),
                    fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${TMDB_KEY}&language=en-US`)
                ]);
                const koData = await koRes.json();
                const enData = await enRes.json();
                const videos = [...(koData.results || []), ...(enData.results || [])];
                const youtubeVideos = videos.filter((video) => video.site === "YouTube");
                const preferredVideo =
                    youtubeVideos.find((video) => video.type === "Clip") ||
                    youtubeVideos.find((video) => video.type === "Teaser") ||
                    youtubeVideos.find((video) => video.type === "Trailer") ||
                    youtubeVideos.find((video) => video.type === "Featurette") ||
                    youtubeVideos[0];

                if (!preferredVideo) return null;

                return {
                    id: Number(preferredVideo.id.replace(/\D/g, "").slice(-8)) || movie.id,
                    movieId: movie.id,
                    title: movie.title,
                    poster_path: movie.poster_path,
                    backdrop_path: movie.backdrop_path,
                    videoKey: preferredVideo.key,
                    videoName: preferredVideo.name,
                    videoType: preferredVideo.type
                };
            })
        );

        const validHighlights = highlightResults.filter(
            (item): item is HighlightItem => item !== null
        );

        set({
            netflixHighlights: validHighlights.slice(0, 8)
        });
    },

    certifications: {},
    onFetchCertification: async (id, mediaType) => {
        const key = `${mediaType}-${id}`;
        const { certifications } = get();
        if (certifications[key] !== undefined) return;

        // 미국 등급 → 한국 등급 환산 (KR 등급이 비어있을 때 폴백)
        const usMovieToKr: Record<string, string> = {
            "G": "전체관람가", "PG": "전체관람가", "PG-13": "15", "R": "19", "NC-17": "19",
        };
        const usTvToKr: Record<string, string> = {
            "TV-Y": "전체관람가", "TV-Y7": "전체관람가", "TV-G": "전체관람가",
            "TV-PG": "12", "TV-14": "15", "TV-MA": "19",
        };

        let cert = "";
        try {
            if (mediaType === "movie") {
                const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/release_dates?api_key=${TMDB_KEY}`);
                const data = await res.json();
                const results = data.results ?? [];
                const kr = results.find((r: any) => r.iso_3166_1 === "KR");
                // KR release_dates 중 비어있지 않은 첫 등급
                cert = (kr?.release_dates ?? []).map((d: any) => d.certification).find((c: string) => c) ?? "";
                if (!cert) {
                    const us = results.find((r: any) => r.iso_3166_1 === "US");
                    const usCert = (us?.release_dates ?? []).map((d: any) => d.certification).find((c: string) => c) ?? "";
                    cert = usMovieToKr[usCert] ?? "";
                }
            } else {
                const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/content_ratings?api_key=${TMDB_KEY}`);
                const data = await res.json();
                const results = data.results ?? [];
                const kr = results.find((r: any) => r.iso_3166_1 === "KR");
                cert = kr?.rating ?? "";
                if (!cert) {
                    const us = results.find((r: any) => r.iso_3166_1 === "US");
                    cert = usTvToKr[us?.rating ?? ""] ?? "";
                }
            }
        } catch {
            cert = "";
        }

        set((state) => ({
            certifications: { ...state.certifications, [key]: cert }
        }));
    },
    fetchMediaDetail: async (id, mediaType) => {
        const mediaId = Number(id);
        const key = `${mediaType}-${mediaId}`;

        // 2. 없으면 API 호출
        try {
            const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${TMDB_KEY}&language=${getTmdbLang()}`);
            const data = await res.json();
            // console.log("플리데이터", data);
            // 4. 데이터 반환
            return data;
        } catch (error) {
            console.error("데이터 가져오기 실패:", error);
            return null;
        }
    },
}))
