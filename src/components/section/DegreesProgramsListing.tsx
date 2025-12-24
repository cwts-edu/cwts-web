import type { DegreesProgramsMetadata, DegreesProgramsCategory } from "@libs/types";
import { type ChangeEvent, useState } from "react";

interface Category {
  label: string;
  value: DegreesProgramsCategory | "all";
}

export interface Props {
  data: DegreesProgramsMetadata[];
  categories: Category[];
  messages: {
    credits: string;
    leftParen: string;
    rightParen: string;
    comma: string;
  };
}

function CategorySelector({
  categories,
  currentValue,
  setCurrentValue,
}: {
  categories: Category[];
  currentValue: string;
  setCurrentValue: (value: string) => void;
}) {
  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setCurrentValue(event.currentTarget.value);
  };
  return (
    <select
      className="border border-gray-300 text-maxpurple text-lg focus:ring-maxpurple focus:border-maxpurple rounded-xl py-2 px-6"
      onChange={onChange}
      value={currentValue}
    >
      {categories.map((category) => (
        <option key={category.value} value={category.value}>
          {category.label}
        </option>
      ))}
    </select>
  );
}

const AngleRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 5.292 5.292"
    fill="currentColor"
    className="w-5 h-5"
  >
    <path d="M1.936 4.498l-.432-.432 1.42-1.42-1.42-1.42.432-.432 1.852 1.852z" />
  </svg>
);

export default function DegreesProgramsListing(props: Props) {
  const [category, setCategory] = useState("all");

  const filteredItems = props.data.filter((value) =>
    category === "all" ? true : value.category.valueOf() === category
  );

  const displayedCategories = props.categories
    .filter((cat) => cat.value !== "all")
    .filter((cat) => {
      // If a specific category is selected, only show that one
      if (category !== "all") {
        return cat.value === category;
      }
      // Otherwise show all categories that have items
      return filteredItems.some((item) => item.category === cat.value);
    });

  return (
    <div className="not-prose">
      <div className="mb-8">
        <CategorySelector
          categories={props.categories}
          currentValue={category}
          setCurrentValue={setCategory}
        />
      </div>
      <div className="flex flex-col gap-6">
        {displayedCategories.map((cat) => {
          const catItems = filteredItems.filter(
            (item) => item.category === cat.value
          );

          if (catItems.length === 0) return null;

          return (
            <div
              key={cat.value}
              id={cat.value}
              className="rounded-lg border border-neutral-300 bg-white p-6"
            >
              <h3 className="text-xl font-bold text-darkviolet mb-6">
                {cat.label}
              </h3>
              <div className="flex flex-col gap-6">
                {catItems.map((item) => (
                  <a
                    key={item.slug}
                    href={item.url}
                    className="flex justify-between items-center group text-black text-base"
                  >
                    <div>
                      <span className="font-bold">{item.title}</span>{" "}
                      <span>
                        {[
                          props.messages.leftParen,
                          item.length,
                          props.messages.comma,
                          item.credits,
                          props.messages.credits,
                          props.messages.rightParen,
                        ].join("")}
                      </span>
                    </div>
                    <div className="text-darkviolet">
                      <AngleRightIcon />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}