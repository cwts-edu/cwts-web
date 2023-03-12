import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper";
import "swiper/css";
import "swiper/css/free-mode";
import "./faculty-row.css";
import type { FacultyMetadata } from "@libs/faculty";

export interface Messages {
  position_prefix: string;
  position_separator: string;
  course_prefix: string;
  course_separator: string;
}

export interface Props {
  faculty: FacultyMetadata[];
  messages: Messages;
}

export default function FacultyRow({ faculty, messages }: Props) {
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
                  {messages.position_prefix}
                  {person.positions.join(messages.position_separator)}
                </div>
              )}
              <div className="my-1">
                {messages.course_prefix}
                {person.courses.join(messages.course_separator)}
              </div>
            </div>
            <div className="py-0.5 text-xs">
              {person.degrees.map((degree, index) => (
                <div className="my-1" key={index}>
                  {degree}
                </div>
              ))}
            </div>
          </a>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
