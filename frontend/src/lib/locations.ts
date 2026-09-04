export interface Ward {
  id: string;
  name: string;
}

export interface District {
  id: string;
  name: string;
  wards: Ward[];
}

export interface Province {
  id: string;
  name: string;
  districts: District[];
}

// Giản lược data cho mục đích demo (Hà Nội, Hồ Chí Minh, Đà Nẵng)
export const vnLocations: Province[] = [
  {
    id: "01",
    name: "Thành phố Hà Nội",
    districts: [
      {
        id: "001",
        name: "Quận Ba Đình",
        wards: [
          { id: "00001", name: "Phường Phúc Xá" },
          { id: "00004", name: "Phường Trúc Bạch" }
        ]
      },
      {
        id: "002",
        name: "Quận Hoàn Kiếm",
        wards: [
          { id: "00037", name: "Phường Phúc Tân" },
          { id: "00040", name: "Phường Đồng Xuân" }
        ]
      }
    ]
  },
  {
    id: "79",
    name: "Thành phố Hồ Chí Minh",
    districts: [
      {
        id: "760",
        name: "Quận 1",
        wards: [
          { id: "26734", name: "Phường Tân Định" },
          { id: "26737", name: "Phường Đa Kao" }
        ]
      },
      {
        id: "761",
        name: "Quận 12",
        wards: [
          { id: "26740", name: "Phường Thạnh Xuân" },
          { id: "26743", name: "Phường Thạnh Lộc" }
        ]
      }
    ]
  },
  {
    id: "48",
    name: "Thành phố Đà Nẵng",
    districts: [
      {
        id: "490",
        name: "Quận Liên Chiểu",
        wards: [
          { id: "20194", name: "Phường Hòa Hiệp Bắc" },
          { id: "20197", name: "Phường Hòa Hiệp Nam" }
        ]
      },
      {
        id: "492",
        name: "Quận Hải Châu",
        wards: [
          { id: "20215", name: "Phường Thanh Bình" },
          { id: "20218", name: "Phường Thuận Phước" }
        ]
      }
    ]
  }
];
