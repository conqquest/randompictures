import { useEffect, useState } from "react";
import { ColorRing } from "react-loader-spinner";

interface RandomImage {
  image: string;
  title: string;
  year: string | number | null;
  description: string | null;
  identifier: string;
}

// ========================================
// Categories
// ========================================

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

// ========================================
// App
// ========================================

function App() {
  const [image, setImage] =
    useState<RandomImage | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [category, setCategory] =
    useState("all");

  const [showMenu, setShowMenu] =
    useState(false);

  const [showInfo, setShowInfo] =
    useState(false);

  // ========================================
  // Load Random Image
  // ========================================

  const loadRandomImage = async (
    selectedCategory = category
  ) => {
    try {
      setLoading(true);
      setShowInfo(false);

      let url =
        "http://localhost:5000/api/random";

      if (selectedCategory !== "all") {
        url +=
          `?category=${encodeURIComponent(
            selectedCategory
          )}`;
      }

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Failed to fetch image"
        );
      }

      const data: RandomImage =
        await response.json();

      setImage(data);
    } catch (error) {
      console.error(
        "Image loading error:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // Initial Image
  // ========================================

  useEffect(() => {
    loadRandomImage("all");
  }, []);

  // ========================================
  // Loading Screen
  // ========================================

  if (loading) {
    return (
      <main className="screen">
        <ColorRing
          visible={true}
          height="65"
          width="65"
          ariaLabel="color-ring-loading"
          wrapperStyle={{}}
          wrapperClass="color-ring-wrapper"
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

  // ========================================
  // Error
  // ========================================

  if (!image) {
    return (
      <main className="screen">
        <p className="loading">
          Failed to load image.
        </p>
      </main>
    );
  }

  // ========================================
  // Main UI
  // ========================================

  return (
    <main
      className="screen"
      onClick={() =>
        loadRandomImage()
      }
    >
      {/* Image */}

      <img
        src={image.image}
        alt={image.title}
        className="random-image"
      />

      {/* ================================= */}
      {/* Three Dot Menu */}
      {/* ================================= */}

      <button
        className="menu-button"
        aria-label="Open categories"
        onClick={(event) => {
          event.stopPropagation();

          setShowMenu(
            (previous) => !previous
          );
        }}
      >
        ⋮
      </button>

      {/* ================================= */}
      {/* Category Menu */}
      {/* ================================= */}

      {showMenu && (
        <div
          className="category-menu"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          {/* General */}

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
                onClick={() => {
                  setCategory(item);
                  setShowMenu(false);

                  loadRandomImage(
                    item
                  );
                }}
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

          {/* India */}

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
                onClick={() => {
                  setCategory(item);
                  setShowMenu(false);

                  loadRandomImage(
                    item
                  );
                }}
              >
                {item}
              </button>
            )
          )}
        </div>
      )}

      {/* ================================= */}
      {/* Bottom Information */}
      {/* ================================= */}

      <div
        className="bottom-overlay"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="image-info">
          <h1>{image.title}</h1>

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

      {/* ================================= */}
      {/* Information Modal */}
      {/* ================================= */}

      {showInfo && (
        <div
          className="info-overlay"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <div className="info-card">
            {/* Close */}

            <button
              className="close-button"
              aria-label="Close"
              onClick={() =>
                setShowInfo(false)
              }
            >
              ×
            </button>

            {/* Title */}

            <h2>{image.title}</h2>

            {/* Year */}

            {image.year && (
              <p className="info-year">
                {image.year}
              </p>
            )}

            {/* Description */}

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

            {/* Source */}

           
          </div>
        </div>
      )}
    </main>
  );
}

export default App;