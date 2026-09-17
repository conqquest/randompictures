import {
  useEffect,
  useRef,
  useState,
} from "react";

import { ColorRing } from "react-loader-spinner";

import "./App.css";

interface RandomImage {
  image: string;
  title: string;
  year: string | number | null;
  description: string | null;
  identifier: string;
  category?: string;
}

interface PreparedImage {
  data: RandomImage;
  element: HTMLImageElement;
  loaded: boolean;
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const categories = {
  general: [
    "all",
    "history",
    "art",
    "photography",
    "nature",
    "science",
    "architecture",
    "maps",
    "people",
    "animals",
    "technology",
    "travel",
  ],

  india: [
    "India",
    "Indian history",
    "Indian art",
    "Indian culture",
    "Indian architecture",
    "Indian photography",
    "Indian cities",
    "Indian villages",
    "Indian people",
    "Indian festivals",
    "Indian traditions",
    "Indian temples",
    "Indian monuments",
    "Indian archaeology",
    "Indian textiles",
    "Indian clothing",
    "Indian food",
    "Indian agriculture",
    "Indian railways",
    "Indian streets",
    "Indian markets",
    "Indian maps",
    "British India",
    "Colonial India",
    "Mughal India",
    "Ancient India",
    "Medieval India",
    "Indian independence",
    "Indian freedom movement",
  ],
};

function App() {
  const [image, setImage] =
    useState<RandomImage | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [loadingNext, setLoadingNext] =
    useState(false);

  const [category, setCategory] =
    useState("all");

  const [showMenu, setShowMenu] =
    useState(false);

  const [showInfo, setShowInfo] =
    useState(false);

  const preparedImageRef =
    useRef<PreparedImage | null>(
      null
    );

  const requestIdRef =
    useRef(0);

  const currentCategoryRef =
    useRef("all");

  const preparePromiseRef =
    useRef<Promise<void> | null>(
      null
    );

  const fetchRandomImage =
    async (
      selectedCategory: string,
      signal?: AbortSignal
    ): Promise<RandomImage> => {
      let url =
        `${API_URL}/api/random`;

      if (
        selectedCategory !==
        "all"
      ) {
        url +=
          `?category=${encodeURIComponent(
            selectedCategory
          )}`;
      }

      const response =
        await fetch(url, {
          signal,
          cache: "no-store",
        });

      if (!response.ok) {
        throw new Error(
          "Failed to fetch image"
        );
      }

      return await response.json();
    };

  /*
   * Actually download the image.
   *
   * fetchPriority = low:
   * background preparation should not
   * compete aggressively with the
   * image the user is currently viewing.
   */
  const prepareNextImage =
    async (
      selectedCategory: string
    ) => {
      if (
        preparePromiseRef.current
      ) {
        return preparePromiseRef.current;
      }

      const promise =
        (async () => {
          try {
            setLoadingNext(true);

            const data =
              await fetchRandomImage(
                selectedCategory
              );

            /*
             * If the category changed while
             * this request was running,
             * don't use the result.
             */
            if (
              currentCategoryRef.current !==
              selectedCategory
            ) {
              return;
            }

            const img =
              new Image();

            img.decoding = "async";
            img.fetchPriority =
              "low";

            const prepared:
              PreparedImage = {
              data,
              element: img,
              loaded: false,
            };

            preparedImageRef.current =
              prepared;

            await new Promise<void>(
              (
                resolve,
                reject
              ) => {
                img.onload =
                  () => {
                    prepared.loaded =
                      true;

                    resolve();
                  };

                img.onerror =
                  () => {
                    if (
                      preparedImageRef
                        .current ===
                      prepared
                    ) {
                      preparedImageRef.current =
                        null;
                    }

                    reject(
                      new Error(
                        "Failed to preload image"
                      )
                    );
                  };

                img.src =
                  data.image;
              }
            );
          } catch (error) {
            console.error(
              "Background image preparation error:",
              error
            );
          } finally {
            setLoadingNext(false);
          }
        })();

      preparePromiseRef.current =
        promise;

      try {
        await promise;
      } finally {
        preparePromiseRef.current =
          null;
      }
    };

  /*
   * High-priority browser image load.
   *
   * Used when the user clicks and the
   * prepared image isn't ready.
   */
  const loadImageWithPriority =
    (
      data: RandomImage
    ): Promise<HTMLImageElement> => {
      return new Promise(
        (
          resolve,
          reject
        ) => {
          const img =
            new Image();

          img.decoding = "async";
          img.fetchPriority =
            "high";

          img.onload =
            async () => {
              try {
                if (
                  "decode" in img
                ) {
                  await img.decode();
                }
              } catch {
                // Image is already loaded.
              }

              resolve(img);
            };

          img.onerror = () => {
            reject(
              new Error(
                "Image download failed"
              )
            );
          };

          img.src =
            data.image;
        }
      );
    };

  /*
   * First image.
   */
  const loadInitialImage =
    async () => {
      const requestId =
        ++requestIdRef.current;

      try {
        setLoading(true);

        const data =
          await fetchRandomImage(
            "all"
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        /*
         * First image gets HIGH priority.
         */
        await loadImageWithPriority(
          data
        );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setImage(data);

        /*
         * Immediately start preparing
         * image #2 in the background.
         */
        prepareNextImage(
          "all"
        );
      } catch (error) {
        console.error(
          "Initial image error:",
          error
        );
      } finally {
        if (
          requestId ===
          requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    };

  /*
   * User clicked the screen.
   */
  const loadRandomImage =
    async () => {
      const requestId =
        ++requestIdRef.current;

      const selectedCategory =
        currentCategoryRef.current;

      setShowInfo(false);

      /*
       * IMPORTANT:
       * Show loader immediately.
       */
      setLoading(true);

      const prepared =
        preparedImageRef.current;

      /*
       * CASE 1:
       * Background image is completely
       * ready.
       *
       * Swap immediately.
       */
      if (
        prepared &&
        prepared.loaded
      ) {
        preparedImageRef.current =
          null;

        setImage(
          prepared.data
        );

        setLoading(false);

        /*
         * Start preparing image after
         * the newly displayed image.
         */
        prepareNextImage(
          selectedCategory
        );

        return;
      }

      /*
       * CASE 2:
       * A background image exists but
       * hasn't finished downloading.
       *
       * Give that exact image HIGH
       * priority instead of waiting for
       * another API request.
       */
      if (
        prepared &&
        !prepared.loaded
      ) {
        prepared.element.fetchPriority =
          "high";

        try {
          await new Promise<void>(
            (
              resolve,
              reject
            ) => {
              if (
                prepared.loaded
              ) {
                resolve();
                return;
              }

              const previousOnLoad =
                prepared
                  .element.onload;

              const previousOnError =
                prepared
                  .element.onerror;

              prepared.element.onload =
                async () => {
                  if (
                    previousOnLoad
                  ) {
                    previousOnLoad.call(
                      prepared.element,
                      new Event(
                        "load"
                      )
                    );
                  }

                  prepared.loaded =
                    true;

                  resolve();
                };

              prepared.element.onerror =
                () => {
                  if (
                    previousOnError
                  ) {
                    previousOnError.call(
                      prepared.element,
                      new Event(
                        "error"
                      )
                    );
                  }

                  reject(
                    new Error(
                      "Prepared image failed"
                    )
                  );
                };
            }
          );

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          preparedImageRef.current =
            null;

          setImage(
            prepared.data
          );

          setLoading(false);

          prepareNextImage(
            selectedCategory
          );

          return;
        } catch {
          preparedImageRef.current =
            null;
        }
      }

      /*
       * CASE 3:
       * No usable prepared image.
       *
       * Start a fresh API request
       * immediately.
       */
      try {
        const data =
          await fetchRandomImage(
            selectedCategory
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        /*
         * HIGH priority because the user
         * explicitly clicked.
         */
        await loadImageWithPriority(
          data
        );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setImage(data);

        /*
         * Prepare the following image.
         */
        prepareNextImage(
          selectedCategory
        );
      } catch (error) {
        console.error(
          "Image loading error:",
          error
        );
      } finally {
        if (
          requestId ===
          requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    };

  /*
   * Category change.
   */
  const selectCategory =
    async (
      selectedCategory: string
    ) => {
      const requestId =
        ++requestIdRef.current;

      currentCategoryRef.current =
        selectedCategory;

      preparedImageRef.current =
        null;

      setCategory(
        selectedCategory
      );

      setShowMenu(false);
      setShowInfo(false);
      setLoading(true);

      try {
        const data =
          await fetchRandomImage(
            selectedCategory
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        await loadImageWithPriority(
          data
        );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setImage(data);

        prepareNextImage(
          selectedCategory
        );
      } catch (error) {
        console.error(
          "Category image error:",
          error
        );
      } finally {
        if (
          requestId ===
          requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    };

  useEffect(() => {
    currentCategoryRef.current =
      "all";

    loadInitialImage();
  }, []);

  if (
    loading &&
    !image
  ) {
    return (
      <main className="screen">
        <ColorRing
          visible={true}
          height="65"
          width="65"
          ariaLabel="loading"
          wrapperStyle={{}}
          wrapperClass=""
          colors={[
            "#e15b64",
            "#f47e60",
            "#f8b26a",
            "#abbd81",
            "#849b87",
          ]}
        />
      </main>
    );
  }

  if (!image) {
    return (
      <main className="screen">
        <p className="loading">
          Failed to load image.
        </p>
      </main>
    );
  }

  return (
    <main
      className="screen"
      onClick={
        loading
          ? undefined
          : loadRandomImage
      }
    >
      <img
        src={image.image}
        alt={image.title}
        className="random-image"
      />

      {loading && (
        <div className="image-loading">
          <ColorRing
            visible={true}
            height="65"
            width="65"
            ariaLabel="loading"
            wrapperStyle={{}}
            wrapperClass=""
            colors={[
              "#e15b64",
              "#f47e60",
              "#f8b26a",
              "#abbd81",
              "#849b87",
            ]}
          />
        </div>
      )}

      <button
        className="menu-button"
        aria-label="Open categories"
        onClick={(event) => {
          event.stopPropagation();

          setShowMenu(
            (previous) =>
              !previous
          );
        }}
      >
        ⋮
      </button>

      {showMenu && (
        <div
          className="category-menu"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <h3>General</h3>

          {categories.general.map(
            (item) => (
              <button
                key={item}
                className={
                  category === item
                    ? "category active"
                    : "category"
                }
                onClick={() =>
                  selectCategory(
                    item
                  )
                }
              >
                {item === "all"
                  ? "All"
                  : item
                      .charAt(0)
                      .toUpperCase() +
                    item.slice(1)}
              </button>
            )
          )}

          <h3>India</h3>

          {categories.india.map(
            (item) => (
              <button
                key={item}
                className={
                  category === item
                    ? "category active"
                    : "category"
                }
                onClick={() =>
                  selectCategory(
                    item
                  )
                }
              >
                {item}
              </button>
            )
          )}
        </div>
      )}

      <div
        className="bottom-overlay"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="image-info">
          <h1>
            {image.title}
          </h1>

          {image.year && (
            <p className="year">
              {image.year}
            </p>
          )}

          <button
            className="read-more"
            onClick={() =>
              setShowInfo(true)
            }
          >
            Read more
          </button>
        </div>
      </div>

      {showInfo && (
        <div
          className="info-overlay"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <div className="info-card">
            <button
              className="close-button"
              aria-label="Close"
              onClick={() =>
                setShowInfo(false)
              }
            >
              ×
            </button>

            <h2>
              {image.title}
            </h2>

            {image.year && (
              <p className="info-year">
                {image.year}
              </p>
            )}

            {image.description ? (
              <p className="info-description">
                {image.description}
              </p>
            ) : (
              <p className="info-description empty-description">
                No description is available
                for this image in the
                Internet Archive.
              </p>
            )}

            <a
              href={`https://archive.org/details/${image.identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              View on Internet Archive
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;