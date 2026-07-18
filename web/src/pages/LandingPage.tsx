import {CSSProperties, useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {api} from "../api/client";
import {useAppContext} from "../AppContext";
import {paths} from "../routes/paths";
import {landingCopy} from "../types/landing";
import {MediaSummary} from "../types/media";

const HERO_POSTER_COUNT = 18;

export const LandingPage = () => {
  const {language} = useAppContext();
  const copy = landingCopy[language];
  const [posters, setPosters] = useState<MediaSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [tv, movies] = await Promise.all([
          api.trendingShows(language, {page: 1}),
          api.trendingMovies(language, {page: 1}),
        ]);
        if (cancelled) {
          return;
        }
        const merged = [...tv.results, ...movies.results]
          .filter((item) => Boolean(item.images.poster))
          .slice(0, HERO_POSTER_COUNT);
        setPosters(merged);
      } catch {
        if (!cancelled) {
          setPosters([]);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" to={paths.landing}>
          {copy.brand}
        </Link>
        <div className="landing-nav-actions">
          <Link className="landing-nav-link" to={paths.home}>
            {copy.openApp}
          </Link>
          <Link className="landing-nav-cta" to={paths.login}>
            {copy.signIn}
          </Link>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-poster-plane">
            {posters.map((item, index) => (
              <img
                alt=""
                className="landing-poster"
                decoding="async"
                key={`${item.mediaType}-${item.id}`}
                loading={index < 8 ? "eager" : "lazy"}
                src={item.images.poster ?? undefined}
                style={{"--poster-i": index} as CSSProperties}
              />
            ))}
          </div>
          <div className="landing-hero-veil" />
        </div>

        <div className="landing-hero-copy">
          <p className="landing-brand-mark">{copy.brand}</p>
          <h1 id="landing-hero-title">{copy.heroHeadline}</h1>
          <p className="landing-hero-support">{copy.heroSupport}</p>
          <div className="landing-cta-row">
            <Link className="landing-cta-primary" to={paths.signup}>
              {copy.primaryCta}
            </Link>
            <Link className="landing-cta-secondary" to={paths.home}>
              {copy.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      {copy.sections.map((section) => (
        <section className="landing-section" key={section.eyebrow}>
          <div className="landing-section-inner">
            <span className="media-kind">{section.eyebrow}</span>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </div>
        </section>
      ))}

      <section className="landing-close">
        <div className="landing-close-inner">
          <h2>{copy.closeHeadline}</h2>
          <p>{copy.closeSupport}</p>
          <Link className="landing-cta-primary" to={paths.signup}>
            {copy.closeCta}
          </Link>
        </div>
      </section>
    </main>
  );
};
