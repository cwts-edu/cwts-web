import type { DegreesProgramsMetadata } from "@libs/degrees_programs";
import { type ChangeEvent, useState } from "react";
import { type Category as DegreeCategory } from "@libs/degrees_programs";

interface Category {
  label: string;
  value: DegreeCategory | "all";
}

export interface Props {
  data: DegreesProgramsMetadata[];
  categories: Category[];
  messages: {
    credits: string;
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

export default function (props: Props) {
  const [category, setCategory] = useState("all");
  const items = props.data.filter((value) =>
    category == "all" ? true : value.category.valueOf() == category
  );
  return (
    <div className="not-prose">
      <div>
        <CategorySelector
          categories={props.categories}
          currentValue={category}
          setCurrentValue={setCategory}
        ></CategorySelector>
      </div>
      <div className="gap-12 py-8 grid grid-cols-1 sm:max-md:grid-cols-2 md:grid-cols-3 text-darkblue">
        {items.map((item) => (
          <div key={item.slug} className="w-fit max-sm:w-full">
            <a href={item.url}>
              <img
                src={item.thumbnail}
                width="240"
                className="max-sm:w-full my-1"
              />
              <div className="text-xl font-semibold">{item.title}</div>
              <div className="flex justify-between text-base">
                <div>{item.length}</div>
                <div>
                  {item.credits}
                  {props.messages.credits}
                </div>
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
