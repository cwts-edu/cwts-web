import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/autoplay";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./carousel.css";
import OptionalLink from "@components/common/OptionalLink";

interface CarouselItem {
  image: string;
  link?: string;
  newWindow?: boolean;
}

export interface Props {
  items: CarouselItem[];
}

export default function Carousel(props: Props) {
  return (
    <div className="carousel-outer">
      <Swiper
        className="carousel"
        navigation={true}
        pagination={{
          clickable: true,
          el: ".carousel-pagination",
        }}
        loop={true}
        autoplay={{
          delay: 5000,
        }}
        modules={[Autoplay, Navigation, Pagination]}
      >
        {props.items.map((item, index) => (
          <SwiperSlide key={index}>
            <OptionalLink url={item.link} newWindow={item.newWindow}>
              <img src={item.image} className={"w-full"} />
            </OptionalLink>
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="carousel-pagination" />
    </div>
  );
}
