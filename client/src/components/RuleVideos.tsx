// Metadata/thumbnail links only: playback always happens on the original YouTube website.
import { useQuery } from "@tanstack/react-query";
import { errorMessage } from "../api/client";
import { fetchPartyRuleVideos } from "../api/videos";
import { Card } from "./ui";

export function RuleVideos({ partyId, gameName }: { partyId: string; gameName: string }) {
  const { data, isPending, error } = useQuery({
    queryKey: ["rule-videos", partyId],
    queryFn: () => fetchPartyRuleVideos(partyId),
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${gameName} board game how to play`)}`;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-semibold">How to play · {gameName}</h2>
        <a className="text-sm font-medium text-brand-700 hover:underline"
          href={searchUrl} target="_blank" rel="noopener noreferrer">Search on YouTube</a>
      </div>
      {isPending ? <p className="text-sm text-slate-500">Finding rule videos…</p> : error ? (
        <p className="text-sm text-slate-600" role="status">
          {errorMessage(error)} You can still use the YouTube search link above.
        </p>
      ) : !data?.videos.length ? (
        <p className="text-sm text-slate-600">No rule videos available yet. Try the YouTube search link.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.videos.slice(0, 6).map(video => (
            <a key={video.id} href={video.url} target="_blank" rel="noopener noreferrer"
              className="group rounded-lg border border-slate-200 p-2 hover:border-brand-500 focus-visible:outline-brand-600">
              <div className="relative overflow-hidden rounded-md bg-slate-100">
                <img src={video.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"
                  className="aspect-video w-full object-cover" />
                {video.duration && <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">{video.duration}</span>}
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-800 group-hover:text-brand-700">{video.title}</p>
              <p className="mt-1 text-xs text-slate-500">{video.channel} · {video.language.startsWith("ko") ? "Korean" : video.language.startsWith("en") ? "English" : "Language not verified"}</p>
              {video.pinned && <p className="mt-1 text-xs font-medium text-brand-700">Pinned by admin</p>}
            </a>
          ))}
        </div>
      )}
      {data?.warning && <p className="mt-2 text-xs text-amber-700" role="status">{data.warning}</p>}
      <p className="mt-3 text-xs text-slate-500">Video previews and metadata are provided by YouTube. Videos open on YouTube; BlueButton does not host them.</p>
    </Card>
  );
}
