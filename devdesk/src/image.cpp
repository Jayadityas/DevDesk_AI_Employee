#include "support.hpp"
#include <windows.h>
#include <wincodec.h>
namespace devdesk {
namespace {
template <class T> struct Com {
    T *p = nullptr;
    ~Com() {
        if (p)
            p->Release();
    }
    T **address() {
        return &p;
    }
    T *operator->() {
        return p;
    }
};
void image_check(HRESULT result) {
    if (FAILED(result))
        throw Error(400, "Screenshot could not be decoded as a complete PNG or JPEG");
}
} // namespace
ImageInfo decode_image(const std::string &bytes) {
    if (bytes.empty() || bytes.size() > 5 * 1024 * 1024)
        throw Error(413, "Screenshot limit is 5 MiB");
    // WIC can tolerate incomplete files. Require the raster's final marker as well as full
    // decoding.
    const std::string png_end("\0\0\0\0IEND\xae\x42\x60\x82", 12);
    const bool png = bytes.size() >= 20 &&
                     bytes.compare(0, 8, std::string("\x89PNG\r\n\x1a\n", 8)) == 0 &&
                     bytes.compare(bytes.size() - 12, 12, png_end) == 0;
    const bool jpeg = bytes.size() >= 4 && static_cast<unsigned char>(bytes[0]) == 0xff &&
                      static_cast<unsigned char>(bytes[1]) == 0xd8 &&
                      static_cast<unsigned char>(bytes[bytes.size() - 2]) == 0xff &&
                      static_cast<unsigned char>(bytes.back()) == 0xd9;
    if (!png && !jpeg)
        throw Error(400, "Screenshot is not a complete PNG or JPEG");
    HRESULT initialized = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(initialized))
        throw std::runtime_error("Image decoder initialization failed");
    struct Uninit {
        ~Uninit() {
            CoUninitialize();
        }
    } uninit;
    Com<IWICImagingFactory> factory;
    image_check(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
                                 IID_PPV_ARGS(factory.address())));
    Com<IWICStream> stream;
    image_check(factory->CreateStream(stream.address()));
    image_check(
        stream->InitializeFromMemory(reinterpret_cast<BYTE *>(const_cast<char *>(bytes.data())),
                                     static_cast<DWORD>(bytes.size())));
    Com<IWICBitmapDecoder> decoder;
    image_check(factory->CreateDecoderFromStream(stream.p, nullptr, WICDecodeMetadataCacheOnLoad,
                                                 decoder.address()));
    GUID format;
    image_check(decoder->GetContainerFormat(&format));
    ImageInfo info;
    if (IsEqualGUID(format, GUID_ContainerFormatPng))
        info.mime = "image/png";
    else if (IsEqualGUID(format, GUID_ContainerFormatJpeg))
        info.mime = "image/jpeg";
    else
        throw Error(400, "Only PNG and JPEG screenshots are allowed");
    UINT frames = 0;
    image_check(decoder->GetFrameCount(&frames));
    if (frames != 1)
        throw Error(400, "Screenshot must contain a single frame");
    Com<IWICBitmapFrameDecode> frame;
    image_check(decoder->GetFrame(0, frame.address()));
    image_check(frame->GetSize(&info.width, &info.height));
    if (!info.width || !info.height || info.width > 4096 || info.height > 4096 ||
        static_cast<uint64_t>(info.width) * info.height > 16000000)
        throw Error(400, "Screenshot dimensions exceed the 4096-pixel / 16-megapixel limit");
    Com<IWICFormatConverter> converter;
    image_check(factory->CreateFormatConverter(converter.address()));
    image_check(converter->Initialize(frame.p, GUID_WICPixelFormat32bppRGBA,
                                      WICBitmapDitherTypeNone, nullptr, 0,
                                      WICBitmapPaletteTypeCustom));
    std::vector<BYTE> pixels(static_cast<size_t>(info.width) * info.height * 4);
    image_check(converter->CopyPixels(nullptr, info.width * 4, static_cast<UINT>(pixels.size()),
                                      pixels.data()));
    return info;
}
} // namespace devdesk
