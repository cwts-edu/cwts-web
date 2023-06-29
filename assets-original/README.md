The original assets to be processed by tools.

Put the images in the source directory and run the command

```sh
npm run process-images
```

The tool will generate desired images in the destination with the consistent format/size/compression.

The source image format can be "jpeg", "jpg", "png", "gif".

| Source Directory         | Destination Directory  | Destination image size | Destination image format   |
|--------------------------|------------------------|------------------------|----------------------------|
| assets-original/covers   | public/images/covers   | 1440x1080, 600x350     | .cover.jpg, .thumbnail.jpg |
| assets-original/news     | public/images/news     | 400x220                | .jpg                       |
| assets-original/carousel | public/images/carousel | 2560x1067              | .jpg                       |

The images in `assets-original` will not be committed to the source repository. Only the converted images will be committed.