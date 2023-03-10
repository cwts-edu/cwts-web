import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper";
import "swiper/css";
import "swiper/css/free-mode";
import "./faculty-row.css";
import type { FacultyMetadata } from "@libs/faculty";
import { T, Language } from "@libs/language";

interface Props {
  faculty: FacultyMetadata[];
  language: Language;
}

export default function FacultyRow({ faculty, language }: Props) {
  return (
    <Swiper
      className="faculty-row"
      slidesPerView={"auto"}
      freeMode={true}
      spaceBetween={24}
      modules={[FreeMode]}
    >
      {faculty.map((person, index) => (
        <SwiperSlide key={index}>
          <a href={person.url}>
            <div>
              <img src={person.photo} className="w-full"></img>
            </div>
            <div className="py-2 text-center">{person.name}</div>
            <div className="py-0.5 text-xs">
              {person.positions && (
                <div className="my-1">
                  {T("position_prefix", language)}
                  {person.positions.join(T("position_separator", language))}
                </div>
              )}
              <div className="my-1">
                {T("course_prefix", language)}
                {person.courses.join(T("course_separator", language))}
              </div>
            </div>
            <div className="py-0.5 text-xs">
              {person.degrees.map((degree) => (
                <div className="my-1">{degree}</div>
              ))}
            </div>
          </a>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
