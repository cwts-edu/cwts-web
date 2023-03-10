import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper";
import "swiper/css";
import "swiper/css/autoplay";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./carousel.css";

interface CarouselItem {
  image: string;
  link: String;
}

export interface Props {
  items: CarouselItem[];
}

export default function Carousel(props: Props) {
  return (
    <Swiper
      className="carousel"
      navigation={true}
      pagination={{
        clickable: true,
      }}
      loop={true}
      autoplay={{
        delay: 5000,
      }}
      modules={[Autoplay, Navigation, Pagination]}
    >
      {props.items.map((item, index) => (
        <SwiperSlide key={index}>
          <a href={item.link.toString()}>
            <img src={item.image} className={"w-full"} />
          </a>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
